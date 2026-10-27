#include "FabWindow.h"

#include <shellapi.h>

#include "FabBridge.h"

#include <algorithm>
#include <cwctype>

#include "include/cef_parser.h"
#include "include/cef_urlrequest.h"
#include "include/wrapper/cef_helpers.h"

namespace
{
	constexpr int DefaultWidth = 1280;
	constexpr int DefaultHeight = 900;

	std::wstring Lower(std::wstring Text)
	{
		std::transform(Text.begin(), Text.end(), Text.begin(), [](wchar_t C) { return static_cast<wchar_t>(std::towlower(C)); });
		return Text;
	}

	std::wstring Widen(const std::string& Text)
	{
		return CefString(Text).ToWString();
	}

	// A field of a struct the page passed, whatever its case: the engine's binding matches struct fields by their
	// lowercased names (FCEFJSStructDeserializerBackend), so the page may send either.
	std::string Field(CefRefPtr<CefDictionaryValue> Struct, const std::string& Name)
	{
		if (!Struct)
		{
			return {};
		}
		CefDictionaryValue::KeyList Keys;
		Struct->GetKeys(Keys);
		for (const CefString& Key : Keys)
		{
			if (Lower(Key.ToWString()) == Lower(Widen(Name)) && Struct->GetType(Key) == VTYPE_STRING)
			{
				return Struct->GetString(Key).ToString();
			}
		}
		return {};
	}

	// The engine plugin's InterceptNavigation (FabBrowser.cpp): a Fab page outside the plugin's pages is loaded as
	// its plugin page (https://www.fab.com/x -> https://www.fab.com/plugins/ue5/x); the 3D previewer and payment
	// pages, and every other site (sign-in, payment providers), load as they are.
	bool PluginUrlFor(const std::wstring& Url, std::wstring& OutPluginUrl)
	{
		const std::wstring Lowered = Lower(Url);
		for (const wchar_t* Base : { L"https://www.fab.com", L"https://fab.com", L"http://www.fab.com", L"http://fab.com" })
		{
			const size_t Length = wcslen(Base);
			if (Lowered.compare(0, Length, Base) != 0 || (Lowered.size() > Length && wcschr(L"/?#", Lowered[Length]) == nullptr))
			{
				continue;
			}
			if (Lowered.find(L"/plugins/ue5") != std::wstring::npos || Lowered.find(L"/dope/") != std::wstring::npos || Lowered.find(L"/payment/") != std::wstring::npos)
			{
				return false;
			}
			std::wstring Remainder = Url.substr(Length);
			if (Remainder.empty() || Remainder[0] != L'/')
			{
				Remainder = L"/" + Remainder;
			}
			OutPluginUrl = Url.substr(0, Length) + L"/plugins/ue5" + Remainder;
			return true;
		}
		return false;
	}

	// One request to the dev server, read as it arrives: the server streams one JSON object per line.
	class DevServerCall : public CefURLRequestClient
	{
	public:
		using LineHandler = std::function<void(CefRefPtr<CefDictionaryValue>)>;

		explicit DevServerCall(LineHandler InOnLine)
			: OnLine(std::move(InOnLine))
		{
		}

		void OnRequestComplete(CefRefPtr<CefURLRequest> Request) override
		{
			if (!Buffer.empty())
			{
				Deliver(Buffer);
				Buffer.clear();
			}
			if (!bAnswered)
			{
				CefRefPtr<CefResponse> Response = Request->GetResponse();
				const int Status = Response ? Response->GetStatus() : 0;
				CefRefPtr<CefDictionaryValue> Failure = CefDictionaryValue::Create();
				Failure->SetString("error", "the dev server did not answer (status " + std::to_string(Status) + ", request status "
					+ std::to_string(static_cast<int>(Request->GetRequestStatus())) + "); is `npm run dev` running?");
				OnLine(Failure);
			}
		}

		void OnUploadProgress(CefRefPtr<CefURLRequest>, int64_t, int64_t) override {}
		void OnDownloadProgress(CefRefPtr<CefURLRequest>, int64_t, int64_t) override {}

		void OnDownloadData(CefRefPtr<CefURLRequest>, const void* Data, size_t Length) override
		{
			Buffer.append(static_cast<const char*>(Data), Length);
			size_t End;
			while ((End = Buffer.find('\n')) != std::string::npos)
			{
				const std::string Line = Buffer.substr(0, End);
				Buffer.erase(0, End + 1);
				Deliver(Line);
			}
		}

		bool GetAuthCredentials(bool, const CefString&, int, const CefString&, const CefString&, CefRefPtr<CefAuthCallback>) override
		{
			return false;
		}

	private:
		void Deliver(const std::string& Line)
		{
			if (Line.find_first_not_of(" \r\t") == std::string::npos)
			{
				return;
			}
			CefRefPtr<CefValue> Parsed = CefParseJSON(Line, JSON_PARSER_RFC);
			CefRefPtr<CefDictionaryValue> Message = Parsed ? Parsed->GetDictionary() : nullptr;
			if (!Message)
			{
				return;
			}
			if (Message->HasKey("result") || Message->HasKey("error"))
			{
				bAnswered = true;
			}
			OnLine(Message);
		}

		LineHandler OnLine;
		std::string Buffer;
		bool bAnswered = false;

		IMPLEMENT_REFCOUNTING(DevServerCall);
	};
}

FabWindow::FabWindow(Options InOptions)
	: Settings(std::move(InOptions))
{
	CefMessageRouterConfig Config;
	Config.js_query_function = FabQueryFunction;
	Config.js_cancel_function = FabQueryCancelFunction;
	Router = CefMessageRouterBrowserSide::Create(Config);
	Router->AddHandler(this, false);
}

void FabWindow::Open(const std::wstring& RequestedUrl)
{
	CEF_REQUIRE_UI_THREAD();
	std::wstring Url = RequestedUrl;
	PluginUrlFor(RequestedUrl, Url);
	if (Browser)
	{
		Browser->GetMainFrame()->LoadURL(Url);
		HWND Window = Browser->GetHost()->GetWindowHandle();
		if (IsIconic(Window))
		{
			ShowWindow(Window, SW_RESTORE);
		}
		SetForegroundWindow(Window);
		return;
	}
	if (!PendingUrl.empty())
	{
		// Created, not up yet (OnAfterCreated): the newest page wins.
		PendingUrl = Url;
		return;
	}
	PendingUrl = Url;
	CreatedOn = Url;

	RECT WorkArea;
	SystemParametersInfoW(SPI_GETWORKAREA, 0, &WorkArea, 0);
	const UINT Dpi = GetDpiForSystem();
	const int Width = std::min<int>(MulDiv(DefaultWidth, Dpi, 96), WorkArea.right - WorkArea.left);
	const int Height = std::min<int>(MulDiv(DefaultHeight, Dpi, 96), WorkArea.bottom - WorkArea.top);
	CefWindowInfo WindowInfo;
	WindowInfo.SetAsPopup(Settings.Owner, PageTitle);
	// A plain native window around the page, like the shell page's own (Alloy) browser: no Chrome toolbar.
	WindowInfo.runtime_style = CEF_RUNTIME_STYLE_ALLOY;
	WindowInfo.bounds = CefRect(WorkArea.left + ((WorkArea.right - WorkArea.left) - Width) / 2, WorkArea.top + ((WorkArea.bottom - WorkArea.top) - Height) / 2, Width, Height);
	// Tells the render process to give this browser's page window.ue.fab (Main.cpp, FabBridge.h).
	CefRefPtr<CefDictionaryValue> ExtraInfo = CefDictionaryValue::Create();
	ExtraInfo->SetBool("fab", true);
	CefBrowserSettings BrowserSettings;
	CefBrowserHost::CreateBrowser(WindowInfo, this, Url, BrowserSettings, ExtraInfo, nullptr);
	Settings.Log(L"[fab] window opening on " + Url);
}

void FabWindow::Close()
{
	if (Browser)
	{
		Browser->GetHost()->CloseBrowser(true);
	}
}

void FabWindow::OnAfterCreated(CefRefPtr<CefBrowser> InBrowser)
{
	CEF_REQUIRE_UI_THREAD();
	// Popups the page opens (a payment provider, a sign-in) share this client; the window's own page is the first.
	if (Browser)
	{
		return;
	}
	Browser = InBrowser;
	// A page asked for while the window was being created.
	if (PendingUrl != CreatedOn)
	{
		Browser->GetMainFrame()->LoadURL(PendingUrl);
	}
	PendingUrl.clear();
}

void FabWindow::OnBeforeClose(CefRefPtr<CefBrowser> InBrowser)
{
	CEF_REQUIRE_UI_THREAD();
	Router->OnBeforeClose(InBrowser);
	if (Browser && Browser->IsSame(InBrowser))
	{
		Browser = nullptr;
		Settings.Log(L"[fab] window closed");
		if (Settings.OnClosed)
		{
			Settings.OnClosed(this);
		}
	}
}

void FabWindow::OnTitleChange(CefRefPtr<CefBrowser> InBrowser, const CefString& Title)
{
	if (Browser && Browser->IsSame(InBrowser))
	{
		PageTitle = Title.ToWString();
		UpdateTitle();
	}
	else
	{
		SetWindowTextW(InBrowser->GetHost()->GetWindowHandle(), Title.ToWString().c_str());
	}
}

void FabWindow::UpdateTitle()
{
	if (!Browser)
	{
		return;
	}
	std::wstring Title = PageTitle;
	for (const auto& [Id, What] : Installs)
	{
		Title += L"  |  " + What;
	}
	SetWindowTextW(Browser->GetHost()->GetWindowHandle(), Title.c_str());
}

bool FabWindow::OnConsoleMessage(CefRefPtr<CefBrowser>, cef_log_severity_t Level, const CefString& Message, const CefString& Source, int Line)
{
	Settings.Log(L"[fab-page] " + std::to_wstring(static_cast<int>(Level)) + L" " + Message.ToWString() + L" (" + Source.ToWString() + L":" + std::to_wstring(Line) + L")");
	return false;
}

bool FabWindow::OnProcessMessageReceived(CefRefPtr<CefBrowser> InBrowser, CefRefPtr<CefFrame> Frame, CefProcessId SourceProcess, CefRefPtr<CefProcessMessage> Message)
{
	return Router->OnProcessMessageReceived(InBrowser, Frame, SourceProcess, Message);
}

bool FabWindow::OnBeforeBrowse(CefRefPtr<CefBrowser> InBrowser, CefRefPtr<CefFrame> Frame, CefRefPtr<CefRequest> Request, bool, bool)
{
	Router->OnBeforeBrowse(InBrowser, Frame);
	if (!Frame->IsMain() || !Browser || !Browser->IsSame(InBrowser))
	{
		return false;
	}
	std::wstring PluginUrl;
	if (PluginUrlFor(Request->GetURL().ToWString(), PluginUrl))
	{
		Settings.Log(L"[fab] " + Request->GetURL().ToWString() + L" -> " + PluginUrl);
		Frame->LoadURL(PluginUrl);
		return true;
	}
	return false;
}

void FabWindow::OnRenderProcessTerminated(CefRefPtr<CefBrowser> InBrowser, TerminationStatus Status, int ErrorCode, const CefString& ErrorString)
{
	Settings.Log(L"[fab] page process ended: status " + std::to_wstring(static_cast<int>(Status)) + L", code " + std::to_wstring(ErrorCode) + L", " + ErrorString.ToWString());
	Router->OnRenderProcessTerminated(InBrowser);
}

void FabWindow::CallDevServer(const std::string& Method, CefRefPtr<CefListValue> Args, LineHandler OnLine)
{
	CefRefPtr<CefDictionaryValue> Body = CefDictionaryValue::Create();
	Body->SetString("method", Method);
	Body->SetList("args", Args ? Args->Copy() : CefListValue::Create());
	CefRefPtr<CefValue> BodyValue = CefValue::Create();
	BodyValue->SetDictionary(Body);
	const std::string Json = CefWriteJSON(BodyValue, JSON_WRITER_DEFAULT).ToString();

	CefRefPtr<CefRequest> Request = CefRequest::Create();
	Request->SetURL(Settings.DevServer + L"/__vge/fab");
	Request->SetMethod("POST");
	CefRequest::HeaderMap Headers;
	Headers.insert({ "Content-Type", "application/json" });
	Headers.insert({ "X-Vge-Shell", Settings.Secret });
	Request->SetHeaderMap(Headers);
	CefRefPtr<CefPostDataElement> Element = CefPostDataElement::Create();
	Element->SetToBytes(Json.size(), Json.data());
	CefRefPtr<CefPostData> PostData = CefPostData::Create();
	PostData->AddElement(Element);
	Request->SetPostData(PostData);
	Request->SetFlags(UR_FLAG_SKIP_CACHE | UR_FLAG_DISABLE_CACHE);
	CefURLRequest::Create(Request, new DevServerCall(std::move(OnLine)), nullptr);
}

void FabWindow::InvokeCallback(const std::string& Name, CefRefPtr<CefListValue> Args)
{
	auto Found = Callbacks.find(Name);
	if (!Browser || Found == Callbacks.end())
	{
		Settings.Log(L"[fab] the page registered no " + Widen(Name) + L" callback");
		return;
	}
	CefRefPtr<CefValue> ArgsValue = CefValue::Create();
	ArgsValue->SetList(Args);
	const std::string Script = "window.__vgeFab && window.__vgeFab.invoke(" + std::to_string(Found->second) + ", " + CefWriteJSON(ArgsValue, JSON_WRITER_DEFAULT).ToString() + ");";
	Browser->GetMainFrame()->ExecuteJavaScript(Script, Browser->GetMainFrame()->GetURL(), 0);
}

void FabWindow::Install(const std::string& Method, CefRefPtr<CefListValue> Args)
{
	CefRefPtr<CefDictionaryValue> Metadata = Args && Args->GetType(1) == VTYPE_DICTIONARY ? Args->GetDictionary(1) : nullptr;
	const std::string Id = Field(Metadata, "AssetId");
	const std::wstring Name = Widen(Field(Metadata, "AssetName").empty() ? Id : Field(Metadata, "AssetName"));
	Installs[Id] = Name + L": starting";
	UpdateTitle();
	Settings.Log(L"[fab] " + Widen(Method) + L" " + Name + L" (" + Widen(Id) + L", " + Widen(Field(Metadata, "AssetType")) + L")");
	CefRefPtr<FabWindow> Self = this;
	CallDevServer(Method, Args, [Self, Id, Name](CefRefPtr<CefDictionaryValue> Line)
	{
		if (Line->HasKey("progress"))
		{
			CefRefPtr<CefDictionaryValue> Progress = Line->GetDictionary("progress");
			const std::wstring Stage = Progress->GetString("stage").ToWString();
			// JSON whole numbers parse as integers, and GetDouble of an integer value is 0.
			const cef_value_type_t PercentType = Progress->GetType("percent");
			const int Percent = PercentType == VTYPE_INT ? Progress->GetInt("percent") : PercentType == VTYPE_DOUBLE ? static_cast<int>(Progress->GetDouble("percent")) : -1;
			Self->Installs[Id] = Name + L": " + Stage + (Percent >= 0 ? L" " + std::to_wstring(Percent) + L"%" : L"");
		}
		else if (Line->HasKey("error"))
		{
			Self->Installs[Id] = Name + L": failed";
			Self->Settings.Log(L"[fab] " + Name + L" failed: " + Line->GetString("error").ToWString());
		}
		else
		{
			Self->Installs[Id] = Name + L": in the project";
			Self->Settings.Log(L"[fab] " + Name + L" is in the project");
		}
		Self->UpdateTitle();
	});
}

bool FabWindow::OnQuery(CefRefPtr<CefBrowser> InBrowser, CefRefPtr<CefFrame> Frame, int64_t, const CefString& Request, bool, CefRefPtr<Callback> Callback)
{
	CefRefPtr<CefValue> Parsed = CefParseJSON(Request, JSON_PARSER_RFC);
	CefRefPtr<CefDictionaryValue> Body = Parsed ? Parsed->GetDictionary() : nullptr;
	if (!Body || !Browser || !Browser->IsSame(InBrowser) || !Frame->IsMain() || !IsFabPage(Frame->GetURL().ToString()))
	{
		Callback->Failure(1, "not a call of window.ue.fab");
		return true;
	}
	const std::string Method = Body->GetString("method").ToString();
	CefRefPtr<CefListValue> Args = Body->GetType("args") == VTYPE_LIST ? Body->GetList("args") : CefListValue::Create();
	const std::wstring First = Args->GetSize() > 0 && Args->GetType(0) == VTYPE_STRING ? Args->GetString(0).ToWString() : L"";

	if (Method == "registercallbacks")
	{
		// FFabCallbacks { OnLogout, OnLogin, OnLogEvent }: each a function the bridge keeps ({"$function": id}).
		Callbacks.clear();
		CefRefPtr<CefDictionaryValue> Functions = Args->GetType(0) == VTYPE_DICTIONARY ? Args->GetDictionary(0) : nullptr;
		CefDictionaryValue::KeyList Keys;
		if (Functions)
		{
			Functions->GetKeys(Keys);
		}
		for (const CefString& Key : Keys)
		{
			CefRefPtr<CefDictionaryValue> Function = Functions->GetType(Key) == VTYPE_DICTIONARY ? Functions->GetDictionary(Key) : nullptr;
			if (Function && Function->HasKey("$function"))
			{
				Callbacks[CefString(Lower(Key.ToWString())).ToString()] = Function->GetInt("$function");
			}
		}
		Callback->Success("");
	}
	else if (Method == "getauthtoken" || Method == "getrefreshtoken" || Method == "getapiversion" || Method == "getsettings")
	{
		CefRefPtr<FabWindow> Self = this;
		const bool bToken = Method == "getauthtoken" || Method == "getrefreshtoken";
		CallDevServer(Method, Args, [Self, Callback, Method, bToken](CefRefPtr<CefDictionaryValue> Line)
		{
			if (Line->HasKey("error"))
			{
				Self->Settings.Log(L"[fab] " + Widen(Method) + L" failed: " + Line->GetString("error").ToWString());
				// The plugin answers an empty token when nobody is signed in (FabAuthentication::GetAuthToken).
				if (bToken)
				{
					Callback->Success("\"\"");
				}
				else
				{
					Callback->Failure(2, Line->GetString("error"));
				}
			}
			else if (Line->HasKey("result"))
			{
				Callback->Success(CefWriteJSON(Line->GetValue("result"), JSON_WRITER_DEFAULT));
			}
		});
	}
	else if (Method == "login" || Method == "logout")
	{
		// The plugin's Login and Logout return at once; the page hears the outcome through its callbacks.
		Callback->Success("");
		CefRefPtr<FabWindow> Self = this;
		const bool bLogin = Method == "login";
		CallDevServer(Method, Args, [Self, bLogin](CefRefPtr<CefDictionaryValue> Line)
		{
			if (Line->HasKey("error"))
			{
				Self->Settings.Log(L"[fab] " + std::wstring(bLogin ? L"sign-in" : L"sign-out") + L" failed: " + Line->GetString("error").ToWString());
				return;
			}
			if (!Line->HasKey("result"))
			{
				return;
			}
			CefRefPtr<CefListValue> CallbackArgs = CefListValue::Create();
			if (bLogin)
			{
				CallbackArgs->SetString(0, Line->GetString("result"));
				Self->InvokeCallback("onlogin", CallbackArgs);
			}
			else
			{
				CallbackArgs->SetInt(0, 0);
				Self->InvokeCallback("onlogout", CallbackArgs);
			}
		});
	}
	else if (Method == "addtoproject" || Method == "installtoproject" || Method == "installtoengine")
	{
		Callback->Success("");
		Install(Method, Args);
		// Pressed and taken: the window goes, and the shell page shows how the install goes (ui/shell/FabNotices.tsx,
		// from the dev server). The install's request outlives the window.
		Close();
	}
	else if (Method == "setpreferredqualitytier")
	{
		Callback->Success("");
		CallDevServer(Method, Args, [](CefRefPtr<CefDictionaryValue>) {});
	}
	else if (Method == "geturl")
	{
		CefRefPtr<CefValue> Url = CefValue::Create();
		Url->SetString(HomeUrl);
		Callback->Success(CefWriteJSON(Url, JSON_WRITER_DEFAULT));
	}
	else if (Method == "openurlinbrowser")
	{
		if (Lower(First).rfind(L"https://", 0) == 0 || Lower(First).rfind(L"http://", 0) == 0)
		{
			ShellExecuteW(nullptr, L"open", First.c_str(), nullptr, nullptr, SW_SHOWNORMAL);
		}
		Callback->Success("");
	}
	else if (Method == "openinnewtab")
	{
		if (Settings.OpenInNew && !First.empty())
		{
			Settings.OpenInNew(First);
		}
		Callback->Success("");
	}
	else if (Method == "copytoclipboard")
	{
		if (OpenClipboard(Browser->GetHost()->GetWindowHandle()))
		{
			EmptyClipboard();
			const size_t Bytes = (First.size() + 1) * sizeof(wchar_t);
			if (HGLOBAL Memory = GlobalAlloc(GMEM_MOVEABLE, Bytes))
			{
				memcpy(GlobalLock(Memory), First.c_str(), Bytes);
				GlobalUnlock(Memory);
				SetClipboardData(CF_UNICODETEXT, Memory);
			}
			CloseClipboard();
		}
		Callback->Success("");
	}
	else
	{
		// pluginopened (analytics), openpluginsettings, dragstart / ondraginfosuccess / ondraginfofailure (dragging a
		// listing into the editor's viewport), executeubergraph (UObject's own function, listed by the binding too):
		// nothing in the kit corresponds to them.
		Settings.Log(L"[fab] " + Widen(Method) + L" (no effect in the kit)");
		Callback->Success("");
	}
	return true;
}
