#include "VgeUI.h"

#include "Dom/JsonObject.h"
#include "Engine/Engine.h"
#include "Engine/GameViewportClient.h"
#include "Framework/Application/SlateApplication.h"
#include "IWebBrowserSchemeHandler.h"
#include "IWebBrowserSingleton.h"
#include "Misc/App.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "SWebBrowser.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "WebBrowserModule.h"
#include "Widgets/Layout/SBox.h"

DEFINE_LOG_CATEGORY_STATIC(LogVgeUI, Log, All);

namespace
{
	// The release build's UI page (`npm run build` stages it in Content/UI) is served to the browser from
	// https://ui.vge/ by the engine's scheme handler mechanism: Chromium refuses the module scripts and
	// stylesheets of a page opened as file:// (origin "null"), so the page needs a real origin.
	const TCHAR* UIScheme = TEXT("https");
	const TCHAR* UIDomain = TEXT("ui.vge");

	class FVgeUIFileHandler : public IWebBrowserSchemeHandler
	{
	public:
		explicit FVgeUIFileHandler(const FString& Url)
		{
			const FString Root = FPaths::ConvertRelativePathToFull(FPaths::ProjectContentDir() / TEXT("UI"));
			FString Path = Url;
			Path.RightChopInline(FCString::Strlen(TEXT("https://ui.vge/")), EAllowShrinking::No);
			int32 End;
			if (Path.FindChar(TEXT('?'), End) || Path.FindChar(TEXT('#'), End))
			{
				Path.LeftInline(End, EAllowShrinking::No);
			}
			FString File = FPaths::ConvertRelativePathToFull(Root / Path);
			FPaths::CollapseRelativeDirectories(File);
			// Only files under Content/UI.
			if (File.StartsWith(Root + TEXT("/")) && FFileHelper::LoadFileToArray(Data, *File, FILEREAD_Silent))
			{
				StatusCode = 200;
				MimeType = MimeTypeOf(FPaths::GetExtension(File).ToLower());
			}
		}

		virtual bool ProcessRequest(const FString& Verb, const FString& Url, const FSimpleDelegate& OnHeadersReady) override
		{
			OnHeadersReady.Execute();
			return true;
		}

		virtual void GetResponseHeaders(IHeaders& OutHeaders) override
		{
			OutHeaders.SetStatusCode(StatusCode);
			OutHeaders.SetMimeType(*MimeType);
			OutHeaders.SetContentLength(Data.Num());
		}

		virtual bool ReadResponse(uint8* OutBytes, int32 BytesToRead, int32& BytesRead, const FSimpleDelegate& OnMoreDataReady) override
		{
			BytesRead = FMath::Min(BytesToRead, Data.Num() - Offset);
			FMemory::Memcpy(OutBytes, Data.GetData() + Offset, BytesRead);
			Offset += BytesRead;
			// CEF (CefResourceHandler::ReadResponse) drops the bytes of a call that returns false: the end of
			// the response is the call that has nothing left to read.
			return BytesRead > 0;
		}

		virtual void Cancel() override {}

	private:
		static FString MimeTypeOf(const FString& Extension)
		{
			static const TMap<FString, FString> Types = {
				{TEXT("html"), TEXT("text/html")}, {TEXT("js"), TEXT("text/javascript")}, {TEXT("css"), TEXT("text/css")},
				{TEXT("json"), TEXT("application/json")}, {TEXT("svg"), TEXT("image/svg+xml")}, {TEXT("png"), TEXT("image/png")},
				{TEXT("jpg"), TEXT("image/jpeg")}, {TEXT("jpeg"), TEXT("image/jpeg")}, {TEXT("webp"), TEXT("image/webp")},
				{TEXT("woff2"), TEXT("font/woff2")}, {TEXT("woff"), TEXT("font/woff")}, {TEXT("ttf"), TEXT("font/ttf")},
				{TEXT("mp3"), TEXT("audio/mpeg")}, {TEXT("ogg"), TEXT("audio/ogg")}, {TEXT("wav"), TEXT("audio/wav")},
			};
			const FString* Type = Types.Find(Extension);
			return Type ? *Type : TEXT("application/octet-stream");
		}

		TArray<uint8> Data;
		int32 Offset = 0;
		int32 StatusCode = 404;
		FString MimeType = TEXT("text/plain");
	};

	class FVgeUIFileHandlerFactory : public IWebBrowserSchemeHandlerFactory
	{
	public:
		virtual TUniquePtr<IWebBrowserSchemeHandler> Create(FString Verb, FString Url) override
		{
			return MakeUnique<FVgeUIFileHandler>(Url);
		}
	};

	// Browsers get the factories registered before they are created, so this runs before the first one.
	void RegisterUIFiles()
	{
		static FVgeUIFileHandlerFactory Factory;
		static bool bRegistered = false;
		if (!bRegistered)
		{
			bRegistered = IWebBrowserModule::Get().GetSingleton()->RegisterSchemeHandlerFactory(UIScheme, UIDomain, &Factory);
		}
	}
}

void UVgeUI::Show(const FString& Url)
{
	// A process without rendering (-nullrhi: agents, tests) has no screen to put a page on.
	if (!FApp::CanEverRender())
	{
		return;
	}
	if (Browser.IsValid())
	{
		Browser->LoadURL(Url);
		return;
	}
	RegisterUIFiles();
	UGameViewportClient* Viewport = GEngine ? GEngine->GameViewport : nullptr;
	if (!Viewport)
	{
		UE_LOGF(LogVgeUI, Error, "No game viewport to put the UI on");
		return;
	}

	SAssignNew(Browser, SWebBrowser)
		.InitialURL(Url)
		.ShowControls(false)
		.ShowAddressBar(false)
		.ShowErrorMessage(true)
		.SupportsTransparency(true)
		.BackgroundColor(FColor(0, 0, 0, 0))
		.BrowserFrameRate(60)
		.OnConsoleMessage_Lambda([](const FString& Message, const FString& Source, int32 Line, EWebBrowserConsoleLogSeverity Severity)
		{
			UE_LOGF(LogVgeUI, Display, "[page] %ls (%ls:%d)", *Message, *Source, Line);
		});
	Browser->BindUObject(TEXT("vge"), this, /*bIsPermanent*/ true);

	// Hit testing follows the page's interactive rectangles: over one the browser takes input, else the game.
	Overlay = SNew(SBox)
		.Visibility_Lambda([this]() { return IsCursorOverInteractive() ? EVisibility::Visible : EVisibility::HitTestInvisible; })
		[
			Browser.ToSharedRef()
		];
	Viewport->AddViewportWidgetContent(Overlay.ToSharedRef(), /*ZOrder*/ 100);
	UE_LOGF(LogVgeUI, Display, "UI overlay showing %ls", *Url);
}

void UVgeUI::Hide()
{
	if (Overlay.IsValid() && GEngine && GEngine->GameViewport)
	{
		GEngine->GameViewport->RemoveViewportWidgetContent(Overlay.ToSharedRef());
	}
	Overlay.Reset();
	Browser.Reset();
	InteractiveRects.Reset();
}

void UVgeUI::Send(const FString& Json)
{
	if (Browser.IsValid())
	{
		Browser->ExecuteJavascript(FString::Printf(TEXT("window.__vgeReceive && window.__vgeReceive(%s)"), *Json));
	}
}

void UVgeUI::Post(const FString& Json)
{
	OnMessage.Broadcast(Json);
}

void UVgeUI::SetInteractiveRects(const FString& Json)
{
	TSharedPtr<FJsonObject> Root;
	if (!FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(Json), Root) || !Root.IsValid())
	{
		return;
	}
	PageWidth = static_cast<float>(Root->GetNumberField(TEXT("width")));
	InteractiveRects.Reset();
	for (const TSharedPtr<FJsonValue>& Value : Root->GetArrayField(TEXT("rects")))
	{
		const TArray<TSharedPtr<FJsonValue>>& R = Value->AsArray();
		if (R.Num() == 4)
		{
			const FVector2f Min(R[0]->AsNumber(), R[1]->AsNumber());
			InteractiveRects.Add(FBox2f(Min, Min + FVector2f(R[2]->AsNumber(), R[3]->AsNumber())));
		}
	}
}

bool UVgeUI::IsCursorOverInteractive() const
{
	if (!Browser.IsValid() || InteractiveRects.IsEmpty() || PageWidth <= 0.f || !FSlateApplication::IsInitialized())
	{
		return false;
	}
	const FGeometry& Geometry = Browser->GetTickSpaceGeometry();
	const FVector2f LocalSize = Geometry.GetLocalSize();
	if (LocalSize.X <= 0.f)
	{
		return false;
	}
	// Slate local units to CSS pixels: the page is laid out across the browser widget's width.
	const FVector2f Local = Geometry.AbsoluteToLocal(FSlateApplication::Get().GetCursorPos());
	const FVector2f Css = Local * (PageWidth / LocalSize.X);
	for (const FBox2f& Rect : InteractiveRects)
	{
		if (Rect.IsInsideOrOn(Css))
		{
			return true;
		}
	}
	return false;
}
