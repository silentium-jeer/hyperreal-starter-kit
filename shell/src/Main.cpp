// Hyperreal Starter Kit: the dev shell. A borderless window with CEF (the engine's own build, from the Unreal
// install) that loads one page, the kit's React app from the dev server: the lab index, the UI kit, and at "/" the
// main scene. A scene in that app is a <GameWorld>, for which the shell starts the game as it is - its own
// process with its own world, V8 and HUD - and keeps its window under the element (ShellWindow, Worlds). Beside it
// the shell opens Fab windows on request: the Fab website with the engine Fab plugin's API (FabWindow, FabBridge.h).
//   HyperrealStarterKit.exe [--url=http://127.0.0.1:5173/] [--game=<VibeGameEngine.exe>] [--saved=<logs and cache>] [--width=1280 --height=720]
//                           [--cdp=9221]  the page's DevTools port (tools/ui.mjs with VGE_CDP=http://127.0.0.1:9221)
//                           [--secret=<hex>]  what the Fab windows' calls to the dev server carry (tools/shell.mjs)
// The release build has no shell: it is the main scene's game alone.
#include <windows.h>
#include <shellapi.h>

#include <filesystem>
#include <cwchar>
#include <set>
#include <string>

#include "include/cef_app.h"
#include "include/cef_parser.h"
#include "include/wrapper/cef_message_router.h"

#include "FabBridge.h"
#include "ShellWindow.h"

namespace
{
	// The app of every process CEF starts from this executable: the browser process shows the window, a render
	// process hosts the page and the renderer side of window.cefQuery. A Fab window's page (FabWindow, created with
	// {"fab": true} as its extra info) gets window.ue.fab instead (FabBridge.h), over a router of its own.
	class ShellApp : public CefApp, public CefRenderProcessHandler
	{
	public:
		CefRefPtr<CefRenderProcessHandler> GetRenderProcessHandler() override { return this; }

		void OnWebKitInitialized() override
		{
			CefMessageRouterConfig Config;
			Router = CefMessageRouterRendererSide::Create(Config);
			CefMessageRouterConfig FabConfig;
			FabConfig.js_query_function = FabQueryFunction;
			FabConfig.js_cancel_function = FabQueryCancelFunction;
			FabRouter = CefMessageRouterRendererSide::Create(FabConfig);
		}

		void OnBrowserCreated(CefRefPtr<CefBrowser> Browser, CefRefPtr<CefDictionaryValue> ExtraInfo) override
		{
			if (ExtraInfo && ExtraInfo->GetBool("fab"))
			{
				FabBrowsers.insert(Browser->GetIdentifier());
			}
		}

		void OnBrowserDestroyed(CefRefPtr<CefBrowser> Browser) override
		{
			FabBrowsers.erase(Browser->GetIdentifier());
		}

		void OnContextCreated(CefRefPtr<CefBrowser> Browser, CefRefPtr<CefFrame> Frame, CefRefPtr<CefV8Context> Context) override
		{
			if (!FabBrowsers.count(Browser->GetIdentifier()))
			{
				Router->OnContextCreated(Browser, Frame, Context);
				return;
			}
			// Only Fab's own pages: a sign-in or payment page the window goes through never sees window.ue.fab.
			if (Frame->IsMain() && IsFabPage(Frame->GetURL().ToString()))
			{
				FabRouter->OnContextCreated(Browser, Frame, Context);
				CefRefPtr<CefV8Value> Result;
				CefRefPtr<CefV8Exception> Exception;
				if (!Context->Eval(FabBridgeScript, "vge://fab-bridge.js", 1, Result, Exception) && Exception)
				{
					// Reaches the shell's log through the page's console (FabWindow::OnConsoleMessage).
					CefRefPtr<CefValue> Text = CefValue::Create();
					Text->SetString("[vge] the fab bridge failed: " + Exception->GetMessage().ToString());
					Frame->ExecuteJavaScript("console.error(" + CefWriteJSON(Text, JSON_WRITER_DEFAULT).ToString() + ")", Frame->GetURL(), 0);
				}
			}
		}

		void OnContextReleased(CefRefPtr<CefBrowser> Browser, CefRefPtr<CefFrame> Frame, CefRefPtr<CefV8Context> Context) override
		{
			Router->OnContextReleased(Browser, Frame, Context);
			FabRouter->OnContextReleased(Browser, Frame, Context);
		}

		bool OnProcessMessageReceived(CefRefPtr<CefBrowser> Browser, CefRefPtr<CefFrame> Frame, CefProcessId SourceProcess, CefRefPtr<CefProcessMessage> Message) override
		{
			return Router->OnProcessMessageReceived(Browser, Frame, SourceProcess, Message)
				|| FabRouter->OnProcessMessageReceived(Browser, Frame, SourceProcess, Message);
		}

	private:
		CefRefPtr<CefMessageRouterRendererSide> Router;
		CefRefPtr<CefMessageRouterRendererSide> FabRouter;
		std::set<int> FabBrowsers;
		IMPLEMENT_REFCOUNTING(ShellApp);
	};

	std::wstring Argument(int Count, wchar_t** Values, const wchar_t* Name, const std::wstring& Default)
	{
		const std::wstring Prefix = std::wstring(L"--") + Name + L"=";
		for (int Index = 1; Index < Count; ++Index)
		{
			const std::wstring Value = Values[Index];
			if (Value.rfind(Prefix, 0) == 0)
			{
				return Value.substr(Prefix.size());
			}
		}
		return Default;
	}

	// A positive whole number, or Default when the text is empty or is not one.
	int Number(const std::wstring& Text, int Default)
	{
		wchar_t* End = nullptr;
		const long Value = std::wcstol(Text.c_str(), &End, 10);
		return (!Text.empty() && End && *End == L'\0' && Value > 0) ? static_cast<int>(Value) : Default;
	}
}

int APIENTRY wWinMain(HINSTANCE Instance, HINSTANCE, LPWSTR, int)
{
	SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
	CefMainArgs MainArgs(Instance);
	CefRefPtr<ShellApp> App = new ShellApp();
	// CEF's helper processes run this same executable and end here.
	const int HelperExit = CefExecuteProcess(MainArgs, App, nullptr);
	if (HelperExit >= 0)
	{
		return HelperExit;
	}

	int Count = 0;
	wchar_t** Values = CommandLineToArgvW(GetCommandLineW(), &Count);
	wchar_t ExePath[MAX_PATH];
	GetModuleFileNameW(nullptr, ExePath, MAX_PATH);
	const std::filesystem::path Root = std::filesystem::path(ExePath).parent_path().parent_path().parent_path();
	const std::filesystem::path Saved = Argument(Count, Values, L"saved", (Root / L"Saved").wstring());
	std::filesystem::create_directories(Saved / L"Logs");

	ShellWindow::Options Options;
	Options.Url = Argument(Count, Values, L"url", L"http://127.0.0.1:5173/");
	// The worlds talk to the same dev server as the page: http://host:port/ -> ws://host:port/__unreal.
	Options.DevServer = L"ws" + Options.Url.substr(Options.Url.find(L':'));
	if (Options.DevServer.back() != L'/')
	{
		Options.DevServer += L'/';
	}
	Options.DevServer += L"__unreal";
	Options.GameExe = Argument(Count, Values, L"game", (Root / L"Build/Package/Windows/VibeGameEngine/Binaries/Win64/VibeGameEngine.exe").wstring());
	Options.LogDir = (Saved / L"Logs").wstring();
	// Sent with the Fab windows' calls to the dev server (X-Vge-Shell; tools/engine.mjs shellSecret).
	Options.Secret = Argument(Count, Values, L"secret", L"");
	Options.Width = Number(Argument(Count, Values, L"width", L""), 1280);
	Options.Height = Number(Argument(Count, Values, L"height", L""), 720);
	// 9222 is a game's own HUD page (`npm run play`, tools/ui.mjs); the shell's page answers on 9221.
	const int DevToolsPort = Number(Argument(Count, Values, L"cdp", L""), 9221);
	LocalFree(Values);

	CefSettings Settings;
	Settings.no_sandbox = true;
	Settings.windowless_rendering_enabled = true;
	Settings.remote_debugging_port = DevToolsPort;
	Settings.background_color = CefColorSetARGB(0, 0, 0, 0);
	CefString(&Settings.root_cache_path) = (Saved / L"Shell").wstring();
	CefString(&Settings.cache_path) = (Saved / L"Shell" / L"Cache").wstring();
	CefString(&Settings.log_file) = (Saved / L"Logs" / L"shell-cef.log").wstring();
	// The engine's CEF runtime keeps its locales under Resources (copied as it is next to the executable).
	CefString(&Settings.locales_dir_path) = (std::filesystem::path(ExePath).parent_path() / L"Resources" / L"locales").wstring();
	if (!CefInitialize(MainArgs, Settings, App, nullptr))
	{
		return 1;
	}

	CefRefPtr<ShellWindow> Shell = new ShellWindow(Options);
	if (!Shell->Create(Instance))
	{
		CefShutdown();
		return 1;
	}
	CefRunMessageLoop();
	Shell = nullptr;
	CefShutdown();
	return 0;
}
