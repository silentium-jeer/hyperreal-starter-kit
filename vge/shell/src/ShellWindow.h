#pragma once

#include <windows.h>

#include <map>
#include <memory>
#include <string>
#include <vector>

#include "include/cef_client.h"
#include "include/wrapper/cef_message_router.h"

#include "FabWindow.h"
#include "Worlds.h"

// The shell window: borderless, layered with per-pixel alpha, showing one page that CEF renders off screen.
// Where the page is transparent the window is too, to the eye and to the mouse, so a world's window placed
// under it shows through and takes the clicks there; everywhere else the page draws and takes the input.
//
// The window has no frame: it is resized from its edges (an invisible band the shell keeps hit-testable) and
// moved by the page's draggable regions (CSS app-region: drag).
//
// The page talks to the shell through window.cefQuery (CEF's message router) with JSON requests:
//   {"cmd":"world.open","scene":"labs/physics","rect":[x,y,w,h]}   persistent; answers {"id":1,"state":"starting"},
//        then {"state":"ready"} once its window is in place and {"state":"exited"} if its process ends
//   {"cmd":"world.rect","id":1,"rect":[x,y,w,h]}                   rects in CSS pixels of the page
//   {"cmd":"world.close","id":1}
//   {"cmd":"window.minimize"} {"cmd":"window.maximize"} (toggles) {"cmd":"window.close"} {"cmd":"window.state"}
//        -> {"maximized":false}
//   {"cmd":"fab.open","url":"https://www.fab.com/listings/<id>"}   the Fab window (FabWindow) on a Fab page, opened
//        if it is not; Fab pages only
//
// The Fab windows close with the shell; the process ends once the page and every Fab window have closed.
class ShellWindow : public CefClient,
					public CefRenderHandler,
					public CefLifeSpanHandler,
					public CefDisplayHandler,
					public CefRequestHandler,
					public CefDragHandler,
					public CefMessageRouterBrowserSide::Handler
{
public:
	struct Options
	{
		std::wstring Url;
		// The dev server's channel the worlds' game processes connect to (-DevServer=).
		std::wstring DevServer;
		std::wstring GameExe;
		std::wstring LogDir;
		// The kit's shell secret, for the Fab windows' calls to the dev server.
		std::wstring Secret;
		// The DevTools port of the first world's HUD page; world N takes this port + N - 1 (0: none).
		int WorldDevToolsPort = 0;
		int Width = 1280;
		int Height = 720;
	};

	explicit ShellWindow(const Options& InOptions);
	~ShellWindow() override;

	// Creates the window and the page's browser.
	bool Create(HINSTANCE Instance);

	// CefClient
	CefRefPtr<CefRenderHandler> GetRenderHandler() override { return this; }
	CefRefPtr<CefLifeSpanHandler> GetLifeSpanHandler() override { return this; }
	CefRefPtr<CefDisplayHandler> GetDisplayHandler() override { return this; }
	CefRefPtr<CefRequestHandler> GetRequestHandler() override { return this; }
	CefRefPtr<CefDragHandler> GetDragHandler() override { return this; }
	bool OnProcessMessageReceived(CefRefPtr<CefBrowser> Browser, CefRefPtr<CefFrame> Frame, CefProcessId SourceProcess, CefRefPtr<CefProcessMessage> Message) override;

	// CefRenderHandler
	void GetViewRect(CefRefPtr<CefBrowser> Browser, CefRect& Rect) override;
	bool GetScreenInfo(CefRefPtr<CefBrowser> Browser, CefScreenInfo& Info) override;
	bool GetScreenPoint(CefRefPtr<CefBrowser> Browser, int ViewX, int ViewY, int& ScreenX, int& ScreenY) override;
	void OnPopupShow(CefRefPtr<CefBrowser> Browser, bool bShow) override;
	void OnPopupSize(CefRefPtr<CefBrowser> Browser, const CefRect& Rect) override;
	void OnPaint(CefRefPtr<CefBrowser> Browser, PaintElementType Type, const RectList& DirtyRects, const void* Buffer, int Width, int Height) override;

	// CefLifeSpanHandler
	void OnAfterCreated(CefRefPtr<CefBrowser> Browser) override;
	void OnBeforeClose(CefRefPtr<CefBrowser> Browser) override;

	// CefDisplayHandler
	bool OnCursorChange(CefRefPtr<CefBrowser> Browser, CefCursorHandle Cursor, cef_cursor_type_t Type, const CefCursorInfo& CustomCursorInfo) override;
	bool OnConsoleMessage(CefRefPtr<CefBrowser> Browser, cef_log_severity_t Level, const CefString& Message, const CefString& Source, int Line) override;

	// CefRequestHandler
	bool OnBeforeBrowse(CefRefPtr<CefBrowser> Browser, CefRefPtr<CefFrame> Frame, CefRefPtr<CefRequest> Request, bool bUserGesture, bool bIsRedirect) override;
	void OnRenderProcessTerminated(CefRefPtr<CefBrowser> Browser, TerminationStatus Status, int ErrorCode, const CefString& ErrorString) override;

	// CefDragHandler
	void OnDraggableRegionsChanged(CefRefPtr<CefBrowser> Browser, CefRefPtr<CefFrame> Frame, const std::vector<CefDraggableRegion>& Regions) override;

	// CefMessageRouterBrowserSide::Handler
	bool OnQuery(CefRefPtr<CefBrowser> Browser, CefRefPtr<CefFrame> Frame, int64_t QueryId, const CefString& Request, bool bPersistent, CefRefPtr<Callback> Callback) override;
	// The page stopped listening to a world (it unmounted, perhaps before it ever heard the world's id): the world
	// goes with it.
	void OnQueryCanceled(CefRefPtr<CefBrowser> Browser, CefRefPtr<CefFrame> Frame, int64_t QueryId) override;

private:
	// A world as the page sees it: its box in CSS pixels, and the persistent query its state goes back on.
	struct PageWorld
	{
		std::vector<double> Rect;
		CefRefPtr<Callback> Updates;
		int64_t QueryId = 0;
	};

	LRESULT HitTest(LPARAM LParam) const;
	void MoveWorlds();
	// While a world holds the mouse, the shell window lets the mouse through (WS_EX_TRANSPARENT): it lies over the
	// world, and its resize band and page pixels would otherwise take the hidden cursor, show their own and take focus.
	void UpdateMouseThrough();
	// The Fab window on Url (a new one when bNewWindow or none is open).
	void OpenFab(const std::wstring& Url, bool bNewWindow);
	// Ends the message loop once the page and every Fab window have closed.
	void QuitWhenAllClosed();
	static LRESULT CALLBACK WindowProc(HWND Window, UINT Message, WPARAM WParam, LPARAM LParam);
	static void CALLBACK OnForegroundChanged(HWINEVENTHOOK Hook, DWORD Event, HWND Window, LONG Object, LONG Child, DWORD Thread, DWORD Time);
	LRESULT HandleMessage(UINT Message, WPARAM WParam, LPARAM LParam);

	void Present();
	void SendMouseButton(UINT Message, WPARAM WParam, LPARAM LParam);
	void SendKey(UINT Message, WPARAM WParam, LPARAM LParam);
	// A rectangle in the page's CSS pixels to screen pixels.
	RECT PageToScreen(const std::vector<double>& Rect) const;
	void Log(const wchar_t* Format, ...);

	Options Settings;
	HWND Window = nullptr;
	HWINEVENTHOOK ForegroundHook = nullptr;
	float Scale = 1.f;
	CefRefPtr<CefBrowser> Browser;
	CefRefPtr<CefMessageRouterBrowserSide> Router;
	std::unique_ptr<Worlds> Running;
	std::map<int, PageWorld> PageWorlds;
	// The page's draggable regions in CSS pixels; a region with draggable false cuts a hole in the ones before it.
	std::vector<CefDraggableRegion> DragRegions;
	FILE* LogFile = nullptr;
	std::vector<CefRefPtr<FabWindow>> FabWindows;
	bool bPageClosed = false;

	// The page as last painted (device pixels, premultiplied BGRA), and an open <select> popup drawn over it.
	std::vector<uint32_t> View;
	int ViewWidth = 0;
	int ViewHeight = 0;
	std::vector<uint32_t> Popup;
	CefRect PopupRect;
	bool bPopupShown = false;

	HDC MemoryDC = nullptr;
	HBITMAP Bitmap = nullptr;
	void* BitmapBits = nullptr;
	int BitmapWidth = 0;
	int BitmapHeight = 0;

	HCURSOR Cursor = nullptr;
	bool bTrackingMouse = false;
	bool bMouseThrough = false;
	// Click counting for double clicks, as the platform counts them.
	int LastClickX = 0;
	int LastClickY = 0;
	UINT LastClickButton = 0;
	LONG LastClickTime = 0;
	int ClickCount = 0;

	IMPLEMENT_REFCOUNTING(ShellWindow);
};
