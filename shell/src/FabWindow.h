#pragma once

#include <windows.h>

#include <functional>
#include <map>
#include <string>

#include "include/cef_client.h"
#include "include/wrapper/cef_message_router.h"

// A Fab window: the Fab website the way the engine's Fab plugin shows it inside the editor
// (Engine/Plugins/Fab/Source/Fab/Private/FabBrowser.cpp), https://www.fab.com/plugins/ue5, in a native window of
// its own beside the shell. Fab links that leave the plugin's pages are taken back to them, as InterceptNavigation
// does.
//
// The page gets window.ue.fab, the plugin's UFabBrowserApi (FabBrowserApi.h) under the names the engine's CEF
// binding gives a bound UObject's functions (lowercased; each call returns a Promise: CEFJSScripting.cpp). The
// bridge script (FabBridge.h, run by the render process for this window) sends every call here over the message
// router as {"method":"addtoproject","args":[...]}. What the plugin answers from the editor's own state is answered
// here; sign-in and installs go to the kit's dev server (POST /__vge/fab), which hands them to the content service:
//   getauthtoken getrefreshtoken getapiversion getsettings   answered by the dev server
//   login logout                                              done there, then the page's OnLogin / OnLogout callback
//   addtoproject installtoproject installtoengine             the install runs there and the window closes; the shell
//                                                             page's notices follow it (ui/shell/FabNotices.tsx)
class FabWindow : public CefClient,
				  public CefLifeSpanHandler,
				  public CefDisplayHandler,
				  public CefRequestHandler,
				  public CefMessageRouterBrowserSide::Handler
{
public:
	struct Options
	{
		// The dev server's origin, http://127.0.0.1:5173.
		std::wstring DevServer;
		// The shell window, the Fab window's owner: an owned window stays above its owner, and the shell keeps its
		// worlds' windows right below itself (Worlds::StackBelow), so a Fab window is never hidden under a world, without
		// being above every other application's windows.
		HWND Owner = nullptr;
		// Proves the calls are the shell's (X-Vge-Shell): the dev server refuses other requests a browser sends.
		std::wstring Secret;
		std::function<void(const std::wstring&)> Log;
		// Another Fab window for a page the Fab site opens "in a new tab" (OpenInNewTab).
		std::function<void(const std::wstring&)> OpenInNew;
		// The window's browser has closed.
		std::function<void(FabWindow*)> OnClosed;
	};

	explicit FabWindow(Options InOptions);

	// The plugin's start page.
	static constexpr const wchar_t* HomeUrl = L"https://www.fab.com/plugins/ue5";

	// Creates the window on Url, or loads Url in it and brings it to the front when it is already open.
	void Open(const std::wstring& Url);
	void Close();

	// CefClient
	CefRefPtr<CefLifeSpanHandler> GetLifeSpanHandler() override { return this; }
	CefRefPtr<CefDisplayHandler> GetDisplayHandler() override { return this; }
	CefRefPtr<CefRequestHandler> GetRequestHandler() override { return this; }
	bool OnProcessMessageReceived(CefRefPtr<CefBrowser> Browser, CefRefPtr<CefFrame> Frame, CefProcessId SourceProcess, CefRefPtr<CefProcessMessage> Message) override;

	// CefLifeSpanHandler
	void OnAfterCreated(CefRefPtr<CefBrowser> Browser) override;
	void OnBeforeClose(CefRefPtr<CefBrowser> Browser) override;

	// CefDisplayHandler
	void OnTitleChange(CefRefPtr<CefBrowser> Browser, const CefString& Title) override;
	bool OnConsoleMessage(CefRefPtr<CefBrowser> Browser, cef_log_severity_t Level, const CefString& Message, const CefString& Source, int Line) override;

	// CefRequestHandler
	bool OnBeforeBrowse(CefRefPtr<CefBrowser> Browser, CefRefPtr<CefFrame> Frame, CefRefPtr<CefRequest> Request, bool bUserGesture, bool bIsRedirect) override;
	void OnRenderProcessTerminated(CefRefPtr<CefBrowser> Browser, TerminationStatus Status, int ErrorCode, const CefString& ErrorString) override;

	// CefMessageRouterBrowserSide::Handler
	bool OnQuery(CefRefPtr<CefBrowser> Browser, CefRefPtr<CefFrame> Frame, int64_t QueryId, const CefString& Request, bool bPersistent, CefRefPtr<Callback> Callback) override;

private:
	// One call to the dev server; every line it streams back is a JSON object: {"progress":{...}}, then {"result":...}
	// or {"error":"..."}.
	using LineHandler = std::function<void(CefRefPtr<CefDictionaryValue>)>;
	void CallDevServer(const std::string& Method, CefRefPtr<CefListValue> Args, LineHandler OnLine);
	// Calls a function the page passed in (RegisterCallbacks), by the name of its field: "onlogin", "onlogout",
	// "onlogevent".
	void InvokeCallback(const std::string& Name, CefRefPtr<CefListValue> Args);
	// The window's title: the page's, then what an install is doing.
	void UpdateTitle();
	void Install(const std::string& Method, CefRefPtr<CefListValue> Args);

	Options Settings;
	CefRefPtr<CefBrowser> Browser;
	CefRefPtr<CefMessageRouterBrowserSide> Router;
	// The page the window was created on, and the newest page asked for until it is up.
	std::wstring CreatedOn;
	std::wstring PendingUrl;
	std::wstring PageTitle = L"Fab";
	// Installs under way, by listing id: what the title shows for each.
	std::map<std::string, std::wstring> Installs;
	// The page's callbacks: field name -> the bridge's function id.
	std::map<std::string, int> Callbacks;

	IMPLEMENT_REFCOUNTING(FabWindow);
};
