#include "ShellWindow.h"

#include <windowsx.h>

#include <algorithm>
#include <cmath>
#include <cstdarg>
#include <cstring>
#include <share.h>

#include "include/cef_app.h"
#include "include/cef_parser.h"
#include "include/wrapper/cef_helpers.h"

#include "FabBridge.h"

namespace
{
	constexpr wchar_t WindowClassName[] = L"HyperrealStarterKitShell";
	// How often the shell looks for the windows of starting worlds and for worlds that ended.
	constexpr UINT_PTR PollTimer = 1;
	constexpr UINT PollMilliseconds = 100;
	// The invisible resize band along the window's edges, in DIPs, and the smallest window, in DIPs.
	constexpr int ResizeBand = 6;
	constexpr int MinWidth = 640;
	constexpr int MinHeight = 400;

	ShellWindow* TheShell = nullptr;

	bool IsKeyDown(int Key) { return (GetKeyState(Key) & 0x8000) != 0; }

	int MouseModifiers(WPARAM WParam)
	{
		int Modifiers = 0;
		if (WParam & MK_CONTROL) Modifiers |= EVENTFLAG_CONTROL_DOWN;
		if (WParam & MK_SHIFT) Modifiers |= EVENTFLAG_SHIFT_DOWN;
		if (IsKeyDown(VK_MENU)) Modifiers |= EVENTFLAG_ALT_DOWN;
		if (WParam & MK_LBUTTON) Modifiers |= EVENTFLAG_LEFT_MOUSE_BUTTON;
		if (WParam & MK_MBUTTON) Modifiers |= EVENTFLAG_MIDDLE_MOUSE_BUTTON;
		if (WParam & MK_RBUTTON) Modifiers |= EVENTFLAG_RIGHT_MOUSE_BUTTON;
		if (GetKeyState(VK_NUMLOCK) & 1) Modifiers |= EVENTFLAG_NUM_LOCK_ON;
		if (GetKeyState(VK_CAPITAL) & 1) Modifiers |= EVENTFLAG_CAPS_LOCK_ON;
		return Modifiers;
	}

	// The keyboard modifiers of a key message, the way CEF's own Windows client reports them (cefclient
	// GetCefKeyboardModifiers): held modifier keys, lock states, the keypad, and which side a modifier key is on.
	int KeyboardModifiers(WPARAM WParam, LPARAM LParam)
	{
		int Modifiers = 0;
		if (IsKeyDown(VK_SHIFT)) Modifiers |= EVENTFLAG_SHIFT_DOWN;
		if (IsKeyDown(VK_CONTROL)) Modifiers |= EVENTFLAG_CONTROL_DOWN;
		if (IsKeyDown(VK_MENU)) Modifiers |= EVENTFLAG_ALT_DOWN;
		if (GetKeyState(VK_NUMLOCK) & 1) Modifiers |= EVENTFLAG_NUM_LOCK_ON;
		if (GetKeyState(VK_CAPITAL) & 1) Modifiers |= EVENTFLAG_CAPS_LOCK_ON;
		const bool bExtended = (LParam & (1 << 24)) != 0;
		switch (WParam)
		{
		case VK_RETURN:
			if (bExtended) Modifiers |= EVENTFLAG_IS_KEY_PAD;
			break;
		case VK_INSERT: case VK_DELETE: case VK_HOME: case VK_END: case VK_PRIOR: case VK_NEXT:
		case VK_UP: case VK_DOWN: case VK_LEFT: case VK_RIGHT:
			if (!bExtended) Modifiers |= EVENTFLAG_IS_KEY_PAD;
			break;
		case VK_NUMLOCK: case VK_NUMPAD0: case VK_NUMPAD1: case VK_NUMPAD2: case VK_NUMPAD3: case VK_NUMPAD4:
		case VK_NUMPAD5: case VK_NUMPAD6: case VK_NUMPAD7: case VK_NUMPAD8: case VK_NUMPAD9:
		case VK_DIVIDE: case VK_MULTIPLY: case VK_SUBTRACT: case VK_ADD: case VK_DECIMAL: case VK_CLEAR:
			Modifiers |= EVENTFLAG_IS_KEY_PAD;
			break;
		case VK_SHIFT:
			Modifiers |= IsKeyDown(VK_LSHIFT) ? EVENTFLAG_IS_LEFT : EVENTFLAG_IS_RIGHT;
			break;
		case VK_CONTROL:
			Modifiers |= IsKeyDown(VK_LCONTROL) ? EVENTFLAG_IS_LEFT : EVENTFLAG_IS_RIGHT;
			break;
		case VK_MENU:
			Modifiers |= IsKeyDown(VK_LMENU) ? EVENTFLAG_IS_LEFT : EVENTFLAG_IS_RIGHT;
			break;
		case VK_LWIN:
			Modifiers |= EVENTFLAG_IS_LEFT;
			break;
		case VK_RWIN:
			Modifiers |= EVENTFLAG_IS_RIGHT;
			break;
		default:
			break;
		}
		return Modifiers;
	}

	std::vector<double> ReadRect(CefRefPtr<CefDictionaryValue> Request)
	{
		std::vector<double> Rect;
		CefRefPtr<CefListValue> List = Request->GetList("rect");
		for (size_t Index = 0; List && Index < List->GetSize() && Index < 4; ++Index)
		{
			// JSON whole numbers parse as integers, and GetDouble of an integer value is 0.
			Rect.push_back(List->GetType(Index) == VTYPE_INT ? List->GetInt(Index) : List->GetDouble(Index));
		}
		return Rect;
	}
}

ShellWindow::ShellWindow(const Options& InOptions)
	: Settings(InOptions)
{
	CefMessageRouterConfig Config;
	Router = CefMessageRouterBrowserSide::Create(Config);
	Router->AddHandler(this, false);
	Running = std::make_unique<Worlds>(Settings.GameExe, Settings.DevServer, Settings.LogDir);
	wchar_t LogPath[MAX_PATH];
	swprintf_s(LogPath, L"%s\\shell-%lu.log", Settings.LogDir.c_str(), GetTickCount());
	// Shared for reading, so the log can be read while the shell runs.
	LogFile = _wfsopen(LogPath, L"w, ccs=UTF-8", _SH_DENYNO);
	Cursor = LoadCursorW(nullptr, IDC_ARROW);
}

ShellWindow::~ShellWindow()
{
	if (LogFile)
	{
		fclose(LogFile);
	}
}

void ShellWindow::Log(const wchar_t* Format, ...)
{
	if (!LogFile)
	{
		return;
	}
	va_list Args;
	va_start(Args, Format);
	vfwprintf(LogFile, Format, Args);
	va_end(Args);
	fputwc(L'\n', LogFile);
	fflush(LogFile);
}

bool ShellWindow::Create(HINSTANCE Instance)
{
	WNDCLASSEXW Class{sizeof(Class)};
	Class.lpfnWndProc = WindowProc;
	Class.hInstance = Instance;
	Class.hCursor = LoadCursorW(nullptr, IDC_ARROW);
	Class.lpszClassName = WindowClassName;
	RegisterClassExW(&Class);

	// Centered on the primary monitor's work area, in physical pixels (the process is per-monitor DPI aware).
	RECT WorkArea;
	SystemParametersInfoW(SPI_GETWORKAREA, 0, &WorkArea, 0);
	const UINT Dpi = GetDpiForSystem();
	const int Width = MulDiv(Settings.Width, Dpi, 96);
	const int Height = MulDiv(Settings.Height, Dpi, 96);
	const int X = WorkArea.left + ((WorkArea.right - WorkArea.left) - Width) / 2;
	const int Y = WorkArea.top + ((WorkArea.bottom - WorkArea.top) - Height) / 2;

	TheShell = this;
	// WS_THICKFRAME makes the window sizable (WM_NCHITTEST edges, snapping) and WM_NCCALCSIZE takes the frame away.
	Window = CreateWindowExW(WS_EX_LAYERED | WS_EX_APPWINDOW, WindowClassName, L"Hyperreal Starter Kit",
		WS_POPUP | WS_THICKFRAME | WS_MINIMIZEBOX | WS_MAXIMIZEBOX | WS_SYSMENU,
		X, Y, Width, Height, nullptr, nullptr, Instance, nullptr);
	if (!Window)
	{
		return false;
	}
	Scale = GetDpiForWindow(Window) / 96.f;
	MemoryDC = CreateCompatibleDC(nullptr);
	ShowWindow(Window, SW_SHOW);
	SetTimer(Window, PollTimer, PollMilliseconds, nullptr);
	// A world's window comes to the front when it is clicked; the shell goes back over it at once.
	ForegroundHook = SetWinEventHook(EVENT_SYSTEM_FOREGROUND, EVENT_SYSTEM_FOREGROUND, nullptr, OnForegroundChanged, 0, 0, WINEVENT_OUTOFCONTEXT);

	CefWindowInfo WindowInfo;
	WindowInfo.SetAsWindowless(Window);
	CefBrowserSettings BrowserSettings;
	BrowserSettings.windowless_frame_rate = 60;
	BrowserSettings.background_color = CefColorSetARGB(0, 0, 0, 0);
	return CefBrowserHost::CreateBrowser(WindowInfo, this, Settings.Url, BrowserSettings, nullptr, nullptr);
}

void CALLBACK ShellWindow::OnForegroundChanged(HWINEVENTHOOK, DWORD, HWND Foreground, LONG, LONG, DWORD, DWORD)
{
	if (TheShell && TheShell->Running->Owns(Foreground))
	{
		SetWindowPos(TheShell->Window, HWND_TOP, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
		TheShell->Running->StackBelow(TheShell->Window);
	}
}

LRESULT CALLBACK ShellWindow::WindowProc(HWND Window, UINT Message, WPARAM WParam, LPARAM LParam)
{
	if (TheShell && !TheShell->Window)
	{
		TheShell->Window = Window;
	}
	if (TheShell && TheShell->Window == Window)
	{
		return TheShell->HandleMessage(Message, WParam, LParam);
	}
	return DefWindowProcW(Window, Message, WParam, LParam);
}

LRESULT ShellWindow::HandleMessage(UINT Message, WPARAM WParam, LPARAM LParam)
{
	CefRefPtr<CefBrowserHost> Host = Browser ? Browser->GetHost() : nullptr;
	switch (Message)
	{
	case WM_TIMER:
		if (WParam == PollTimer)
		{
			for (const Worlds::Change& Change : Running->Poll(Window))
			{
				auto Found = PageWorlds.find(Change.Id);
				if (Found == PageWorlds.end())
				{
					continue;
				}
				const bool bReady = Change.What == Worlds::Event::Ready;
				Found->second.Updates->Success(bReady ? "{\"state\":\"ready\"}" : "{\"state\":\"exited\"}");
				Log(L"[worlds] %d %s", Change.Id, bReady ? L"ready" : L"exited");
				if (!bReady)
				{
					PageWorlds.erase(Found);
				}
			}
		}
		return 0;

	case WM_NCCALCSIZE:
		return 0;

	case WM_NCHITTEST:
		return HitTest(LParam);

	case WM_GETMINMAXINFO:
	{
		MINMAXINFO* Info = reinterpret_cast<MINMAXINFO*>(LParam);
		Info->ptMinTrackSize = POINT{static_cast<LONG>(MinWidth * Scale), static_cast<LONG>(MinHeight * Scale)};
		// Maximized means the monitor's work area, not past the taskbar (a frameless window would cover it).
		MONITORINFO Monitor{sizeof(Monitor)};
		if (GetMonitorInfoW(MonitorFromWindow(Window, MONITOR_DEFAULTTONEAREST), &Monitor))
		{
			Info->ptMaxPosition = POINT{Monitor.rcWork.left - Monitor.rcMonitor.left, Monitor.rcWork.top - Monitor.rcMonitor.top};
			Info->ptMaxSize = POINT{Monitor.rcWork.right - Monitor.rcWork.left, Monitor.rcWork.bottom - Monitor.rcWork.top};
		}
		return 0;
	}

	case WM_LBUTTONDOWN: case WM_RBUTTONDOWN: case WM_MBUTTONDOWN:
	case WM_LBUTTONUP: case WM_RBUTTONUP: case WM_MBUTTONUP:
		SendMouseButton(Message, WParam, LParam);
		return 0;

	case WM_MOUSEMOVE:
		if (Host)
		{
			if (!bTrackingMouse)
			{
				TRACKMOUSEEVENT Track{sizeof(Track), TME_LEAVE, Window, 0};
				TrackMouseEvent(&Track);
				bTrackingMouse = true;
			}
			CefMouseEvent Event;
			Event.x = static_cast<int>(GET_X_LPARAM(LParam) / Scale);
			Event.y = static_cast<int>(GET_Y_LPARAM(LParam) / Scale);
			Event.modifiers = MouseModifiers(WParam);
			Host->SendMouseMoveEvent(Event, false);
		}
		return 0;

	case WM_MOUSELEAVE:
		bTrackingMouse = false;
		if (Host)
		{
			POINT Point;
			GetCursorPos(&Point);
			ScreenToClient(Window, &Point);
			CefMouseEvent Event;
			Event.x = static_cast<int>(Point.x / Scale);
			Event.y = static_cast<int>(Point.y / Scale);
			Host->SendMouseMoveEvent(Event, true);
		}
		return 0;

	case WM_MOUSEWHEEL: case WM_MOUSEHWHEEL:
		if (Host)
		{
			POINT Point{GET_X_LPARAM(LParam), GET_Y_LPARAM(LParam)};
			ScreenToClient(Window, &Point);
			CefMouseEvent Event;
			Event.x = static_cast<int>(Point.x / Scale);
			Event.y = static_cast<int>(Point.y / Scale);
			Event.modifiers = MouseModifiers(GET_KEYSTATE_WPARAM(WParam));
			const int Delta = GET_WHEEL_DELTA_WPARAM(WParam);
			const bool bHorizontal = Message == WM_MOUSEHWHEEL || IsKeyDown(VK_SHIFT);
			Host->SendMouseWheelEvent(Event, bHorizontal ? Delta : 0, bHorizontal ? 0 : Delta);
		}
		return 0;

	case WM_SETCURSOR:
		if (LOWORD(LParam) == HTCLIENT)
		{
			SetCursor(Cursor);
			return TRUE;
		}
		break;

	case WM_KEYDOWN: case WM_KEYUP: case WM_CHAR:
		SendKey(Message, WParam, LParam);
		return 0;

	case WM_SYSKEYDOWN: case WM_SYSKEYUP: case WM_SYSCHAR:
		// Alt+F4 and the system menu keep working as in any window.
		SendKey(Message, WParam, LParam);
		break;

	case WM_SETFOCUS: case WM_KILLFOCUS:
		if (Host)
		{
			Host->SetFocus(Message == WM_SETFOCUS);
		}
		return 0;

	case WM_SIZE:
		if (WParam == SIZE_MINIMIZED)
		{
			Running->SetVisible(false);
		}
		else
		{
			Running->SetVisible(true);
			if (Host)
			{
				Host->WasResized();
			}
		}
		return 0;

	case WM_WINDOWPOSCHANGED:
		// The worlds keep their places on the page wherever the window goes; a resize also re-lays the page out,
		// and the page then sends the new boxes (world.rect).
		MoveWorlds();
		break;

	case WM_DPICHANGED:
	{
		Scale = HIWORD(WParam) / 96.f;
		const RECT* Suggested = reinterpret_cast<const RECT*>(LParam);
		SetWindowPos(Window, nullptr, Suggested->left, Suggested->top, Suggested->right - Suggested->left, Suggested->bottom - Suggested->top, SWP_NOZORDER | SWP_NOACTIVATE);
		if (Host)
		{
			Host->NotifyScreenInfoChanged();
			Host->WasResized();
		}
		return 0;
	}

	case WM_CLOSE:
		Running->CloseAll();
		PageWorlds.clear();
		for (const CefRefPtr<FabWindow>& Fab : std::vector<CefRefPtr<FabWindow>>(FabWindows))
		{
			Fab->Close();
		}
		if (Browser)
		{
			// The window goes away once the browser has closed (OnBeforeClose).
			Browser->GetHost()->CloseBrowser(true);
			return 0;
		}
		break;

	case WM_DESTROY:
		KillTimer(Window, PollTimer);
		if (ForegroundHook)
		{
			UnhookWinEvent(ForegroundHook);
		}
		return 0;
	}
	return DefWindowProcW(Window, Message, WParam, LParam);
}

void ShellWindow::SendMouseButton(UINT Message, WPARAM WParam, LPARAM LParam)
{
	if (!Browser)
	{
		return;
	}
	const bool bUp = Message == WM_LBUTTONUP || Message == WM_RBUTTONUP || Message == WM_MBUTTONUP;
	const cef_mouse_button_type_t Button = (Message == WM_LBUTTONDOWN || Message == WM_LBUTTONUP) ? MBT_LEFT
		: (Message == WM_RBUTTONDOWN || Message == WM_RBUTTONUP) ? MBT_RIGHT : MBT_MIDDLE;
	const int X = GET_X_LPARAM(LParam);
	const int Y = GET_Y_LPARAM(LParam);
	if (!bUp)
	{
		const LONG Time = GetMessageTime();
		const bool bSameClick = Button == LastClickButton && (Time - LastClickTime) <= static_cast<LONG>(GetDoubleClickTime())
			&& std::abs(X - LastClickX) <= GetSystemMetrics(SM_CXDOUBLECLK) / 2 && std::abs(Y - LastClickY) <= GetSystemMetrics(SM_CYDOUBLECLK) / 2;
		ClickCount = bSameClick ? ClickCount + 1 : 1;
		LastClickX = X;
		LastClickY = Y;
		LastClickTime = Time;
		LastClickButton = Button;
		SetCapture(Window);
		SetFocus(Window);
	}
	else
	{
		ReleaseCapture();
	}
	CefMouseEvent Event;
	Event.x = static_cast<int>(X / Scale);
	Event.y = static_cast<int>(Y / Scale);
	Event.modifiers = MouseModifiers(WParam);
	Browser->GetHost()->SendMouseClickEvent(Event, Button, bUp, ClickCount);
}

void ShellWindow::SendKey(UINT Message, WPARAM WParam, LPARAM LParam)
{
	if (!Browser)
	{
		return;
	}
	CefKeyEvent Event;
	Event.windows_key_code = static_cast<int>(WParam);
	Event.native_key_code = static_cast<int>(LParam);
	Event.is_system_key = Message == WM_SYSCHAR || Message == WM_SYSKEYDOWN || Message == WM_SYSKEYUP;
	Event.type = (Message == WM_KEYDOWN || Message == WM_SYSKEYDOWN) ? KEYEVENT_RAWKEYDOWN
		: (Message == WM_KEYUP || Message == WM_SYSKEYUP) ? KEYEVENT_KEYUP : KEYEVENT_CHAR;
	Event.modifiers = KeyboardModifiers(WParam, LParam);
	Browser->GetHost()->SendKeyEvent(Event);
}

void ShellWindow::GetViewRect(CefRefPtr<CefBrowser>, CefRect& Rect)
{
	RECT Client;
	GetClientRect(Window, &Client);
	Rect = CefRect(0, 0, std::max(1, static_cast<int>(std::lround(Client.right / Scale))), std::max(1, static_cast<int>(std::lround(Client.bottom / Scale))));
}

bool ShellWindow::GetScreenInfo(CefRefPtr<CefBrowser> InBrowser, CefScreenInfo& Info)
{
	CefRect View;
	GetViewRect(InBrowser, View);
	Info.device_scale_factor = Scale;
	Info.rect = View;
	Info.available_rect = View;
	return true;
}

bool ShellWindow::GetScreenPoint(CefRefPtr<CefBrowser>, int ViewX, int ViewY, int& ScreenX, int& ScreenY)
{
	POINT Point{static_cast<LONG>(ViewX * Scale), static_cast<LONG>(ViewY * Scale)};
	ClientToScreen(Window, &Point);
	ScreenX = Point.x;
	ScreenY = Point.y;
	return true;
}

void ShellWindow::OnPopupShow(CefRefPtr<CefBrowser>, bool bShow)
{
	bPopupShown = bShow;
	if (!bShow)
	{
		Popup.clear();
		PopupRect = CefRect();
		Present();
	}
}

void ShellWindow::OnPopupSize(CefRefPtr<CefBrowser>, const CefRect& Rect)
{
	// View coordinates; the popup's pixels arrive in device pixels.
	PopupRect = CefRect(static_cast<int>(Rect.x * Scale), static_cast<int>(Rect.y * Scale), static_cast<int>(Rect.width * Scale), static_cast<int>(Rect.height * Scale));
}

void ShellWindow::OnPaint(CefRefPtr<CefBrowser>, PaintElementType Type, const RectList&, const void* Buffer, int Width, int Height)
{
	const uint32_t* Pixels = static_cast<const uint32_t*>(Buffer);
	if (Type == PET_VIEW)
	{
		View.assign(Pixels, Pixels + static_cast<size_t>(Width) * Height);
		ViewWidth = Width;
		ViewHeight = Height;
	}
	else
	{
		Popup.assign(Pixels, Pixels + static_cast<size_t>(Width) * Height);
		PopupRect.width = Width;
		PopupRect.height = Height;
	}
	Present();
}

// The page (with an open popup over it) into the layered window: the buffer is BGRA with premultiplied alpha,
// which is what UpdateLayeredWindow composites, and fully transparent pixels let the mouse through.
void ShellWindow::Present()
{
	if (View.empty())
	{
		return;
	}
	RECT Bounds;
	GetWindowRect(Window, &Bounds);
	const int Width = Bounds.right - Bounds.left;
	const int Height = Bounds.bottom - Bounds.top;
	if (Width <= 0 || Height <= 0)
	{
		return;
	}
	if (Width != BitmapWidth || Height != BitmapHeight)
	{
		if (Bitmap)
		{
			DeleteObject(Bitmap);
		}
		BITMAPINFO Info{};
		Info.bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
		Info.bmiHeader.biWidth = Width;
		Info.bmiHeader.biHeight = -Height;
		Info.bmiHeader.biPlanes = 1;
		Info.bmiHeader.biBitCount = 32;
		Info.bmiHeader.biCompression = BI_RGB;
		Bitmap = CreateDIBSection(MemoryDC, &Info, DIB_RGB_COLORS, &BitmapBits, nullptr, 0);
		SelectObject(MemoryDC, Bitmap);
		BitmapWidth = Width;
		BitmapHeight = Height;
	}
	uint32_t* Target = static_cast<uint32_t*>(BitmapBits);
	std::memset(Target, 0, static_cast<size_t>(Width) * Height * 4);
	const int Rows = std::min(Height, ViewHeight);
	const int Columns = std::min(Width, ViewWidth);
	for (int Row = 0; Row < Rows; ++Row)
	{
		std::memcpy(Target + static_cast<size_t>(Row) * Width, View.data() + static_cast<size_t>(Row) * ViewWidth, static_cast<size_t>(Columns) * 4);
	}
	if (bPopupShown && !Popup.empty())
	{
		for (int Row = 0; Row < PopupRect.height; ++Row)
		{
			const int Y = PopupRect.y + Row;
			if (Y < 0 || Y >= Height)
			{
				continue;
			}
			for (int Column = 0; Column < PopupRect.width; ++Column)
			{
				const int X = PopupRect.x + Column;
				if (X >= 0 && X < Width)
				{
					Target[static_cast<size_t>(Y) * Width + X] = Popup[static_cast<size_t>(Row) * PopupRect.width + Column];
				}
			}
		}
	}
	// The resize band: fully transparent pixels let the mouse through to the world under the window, so along the
	// edges every pixel keeps at least the smallest alpha, which no eye sees and the hit test still takes.
	if (!IsZoomed(Window))
	{
		const int Band = std::min(static_cast<int>(ResizeBand * Scale), std::min(Width, Height) / 2);
		auto Keep = [Target, Width](int X, int Y)
		{
			uint32_t& Pixel = Target[static_cast<size_t>(Y) * Width + X];
			if ((Pixel >> 24) == 0)
			{
				Pixel = 0x01000000;
			}
		};
		for (int Y = 0; Y < Height; ++Y)
		{
			if (Y < Band || Y >= Height - Band)
			{
				for (int X = 0; X < Width; ++X) Keep(X, Y);
				continue;
			}
			for (int X = 0; X < Band; ++X) Keep(X, Y);
			for (int X = Width - Band; X < Width; ++X) Keep(X, Y);
		}
	}
	POINT Destination{Bounds.left, Bounds.top};
	SIZE Size{Width, Height};
	POINT Source{0, 0};
	BLENDFUNCTION Blend{AC_SRC_OVER, 0, 255, AC_SRC_ALPHA};
	HDC Screen = GetDC(nullptr);
	if (!UpdateLayeredWindow(Window, Screen, &Destination, &Size, MemoryDC, &Source, 0, &Blend, ULW_ALPHA))
	{
		Log(L"[shell] UpdateLayeredWindow failed: %lu", GetLastError());
	}
	ReleaseDC(nullptr, Screen);
}

void ShellWindow::OnAfterCreated(CefRefPtr<CefBrowser> InBrowser)
{
	CEF_REQUIRE_UI_THREAD();
	Browser = InBrowser;
	Log(L"[shell] page %s", Settings.Url.c_str());
}

void ShellWindow::OnBeforeClose(CefRefPtr<CefBrowser> InBrowser)
{
	CEF_REQUIRE_UI_THREAD();
	Router->OnBeforeClose(InBrowser);
	Browser = nullptr;
	DestroyWindow(Window);
	bPageClosed = true;
	QuitWhenAllClosed();
}

void ShellWindow::QuitWhenAllClosed()
{
	if (bPageClosed && FabWindows.empty())
	{
		CefQuitMessageLoop();
	}
}

void ShellWindow::OpenFab(const std::wstring& Url, bool bNewWindow)
{
	if (!bNewWindow && !FabWindows.empty())
	{
		FabWindows.front()->Open(Url);
		return;
	}
	FabWindow::Options FabOptions;
	// http://127.0.0.1:5173/ -> http://127.0.0.1:5173
	FabOptions.DevServer = Settings.Url.substr(0, Settings.Url.find(L'/', Settings.Url.find(L"//") + 2));
	FabOptions.Secret = Settings.Secret;
	FabOptions.Owner = Window;
	FabOptions.Log = [this](const std::wstring& Line) { Log(L"%s", Line.c_str()); };
	FabOptions.OpenInNew = [this](const std::wstring& NewUrl) { OpenFab(NewUrl, true); };
	FabOptions.OnClosed = [this](FabWindow* Closed)
	{
		std::erase_if(FabWindows, [Closed](const CefRefPtr<FabWindow>& Each) { return Each.get() == Closed; });
		QuitWhenAllClosed();
	};
	CefRefPtr<FabWindow> Fab = new FabWindow(FabOptions);
	FabWindows.push_back(Fab);
	Fab->Open(Url);
}

bool ShellWindow::OnCursorChange(CefRefPtr<CefBrowser>, CefCursorHandle InCursor, cef_cursor_type_t, const CefCursorInfo&)
{
	Cursor = InCursor;
	SetCursor(Cursor);
	return true;
}

bool ShellWindow::OnConsoleMessage(CefRefPtr<CefBrowser>, cef_log_severity_t Level, const CefString& Message, const CefString& Source, int Line)
{
	Log(L"[page] %d %s (%s:%d)", static_cast<int>(Level), Message.ToWString().c_str(), Source.ToWString().c_str(), Line);
	return false;
}

bool ShellWindow::OnProcessMessageReceived(CefRefPtr<CefBrowser> InBrowser, CefRefPtr<CefFrame> Frame, CefProcessId SourceProcess, CefRefPtr<CefProcessMessage> Message)
{
	return Router->OnProcessMessageReceived(InBrowser, Frame, SourceProcess, Message);
}

bool ShellWindow::OnBeforeBrowse(CefRefPtr<CefBrowser> InBrowser, CefRefPtr<CefFrame> Frame, CefRefPtr<CefRequest>, bool, bool)
{
	Router->OnBeforeBrowse(InBrowser, Frame);
	// A new document in the main frame (a link, a reload) leaves the old page's worlds without an owner: a page
	// that goes away does not unmount its elements. Route changes inside the app do not come here.
	if (Frame->IsMain())
	{
		Running->CloseAll();
		PageWorlds.clear();
		DragRegions.clear();
	}
	return false;
}

void ShellWindow::OnRenderProcessTerminated(CefRefPtr<CefBrowser> InBrowser, TerminationStatus Status, int ErrorCode, const CefString& ErrorString)
{
	Log(L"[shell] page process ended: status %d, code %d, %s", static_cast<int>(Status), ErrorCode, ErrorString.ToWString().c_str());
	Router->OnRenderProcessTerminated(InBrowser);
}

void ShellWindow::OnDraggableRegionsChanged(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame> Frame, const std::vector<CefDraggableRegion>& Regions)
{
	if (Frame->IsMain())
	{
		DragRegions = Regions;
	}
}

// The edges resize the window, the page's draggable regions move it, everything else is the page's.
LRESULT ShellWindow::HitTest(LPARAM LParam) const
{
	POINT Point{GET_X_LPARAM(LParam), GET_Y_LPARAM(LParam)};
	ScreenToClient(Window, &Point);
	RECT Client;
	GetClientRect(Window, &Client);
	if (!IsZoomed(Window))
	{
		const int Band = static_cast<int>(ResizeBand * Scale);
		const bool bLeft = Point.x < Band;
		const bool bRight = Point.x >= Client.right - Band;
		const bool bTop = Point.y < Band;
		const bool bBottom = Point.y >= Client.bottom - Band;
		if (bTop && bLeft) return HTTOPLEFT;
		if (bTop && bRight) return HTTOPRIGHT;
		if (bBottom && bLeft) return HTBOTTOMLEFT;
		if (bBottom && bRight) return HTBOTTOMRIGHT;
		if (bLeft) return HTLEFT;
		if (bRight) return HTRIGHT;
		if (bTop) return HTTOP;
		if (bBottom) return HTBOTTOM;
	}
	const int X = static_cast<int>(Point.x / Scale);
	const int Y = static_cast<int>(Point.y / Scale);
	bool bDraggable = false;
	for (const CefDraggableRegion& Region : DragRegions)
	{
		const cef_rect_t& B = Region.bounds;
		if (X >= B.x && X < B.x + B.width && Y >= B.y && Y < B.y + B.height)
		{
			bDraggable = Region.draggable != 0;
		}
	}
	return bDraggable ? HTCAPTION : HTCLIENT;
}

// Every world back under its box, from the boxes the page last sent: after the window moved or resized.
void ShellWindow::MoveWorlds()
{
	for (const auto& [Id, World] : PageWorlds)
	{
		Running->Move(Id, PageToScreen(World.Rect));
	}
	Running->StackBelow(Window);
}

RECT ShellWindow::PageToScreen(const std::vector<double>& Rect) const
{
	POINT Origin{0, 0};
	ClientToScreen(Window, &Origin);
	const LONG Left = Origin.x + static_cast<LONG>(std::lround(Rect[0] * Scale));
	const LONG Top = Origin.y + static_cast<LONG>(std::lround(Rect[1] * Scale));
	return RECT{Left, Top, Left + static_cast<LONG>(std::lround(Rect[2] * Scale)), Top + static_cast<LONG>(std::lround(Rect[3] * Scale))};
}

void ShellWindow::OnQueryCanceled(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame>, int64_t QueryId)
{
	for (auto It = PageWorlds.begin(); It != PageWorlds.end(); ++It)
	{
		if (It->second.QueryId == QueryId)
		{
			Running->Close(It->first);
			Log(L"[worlds] %d closed (the page stopped listening)", It->first);
			PageWorlds.erase(It);
			return;
		}
	}
}

bool ShellWindow::OnQuery(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame>, int64_t QueryId, const CefString& Request, bool, CefRefPtr<Callback> Callback)
{
	CefRefPtr<CefValue> Parsed = CefParseJSON(Request, JSON_PARSER_RFC);
	CefRefPtr<CefDictionaryValue> Body = Parsed ? Parsed->GetDictionary() : nullptr;
	if (!Body)
	{
		Callback->Failure(1, "the request is not a JSON object");
		return true;
	}
	const std::string Command = Body->GetString("cmd");
	const std::vector<double> Rect = ReadRect(Body);
	if (Command == "world.open")
	{
		// A game window created with no size never takes one later (UGameEngine::CreateGameWindow -ResX/-ResY).
		if (Rect.size() != 4 || Rect[2] < 1 || Rect[3] < 1)
		{
			Callback->Failure(2, "world.open needs scene and a non-empty rect [x, y, width, height]");
			return true;
		}
		const std::wstring Scene = Body->GetString("scene").ToWString();
		const int Id = Running->Open(Scene, PageToScreen(Rect));
		if (!Id)
		{
			Callback->Failure(3, "the game process could not be started");
			return true;
		}
		Log(L"[worlds] %d: %s", Id, Scene.c_str());
		// The query stays open (persistent): the world's later states go back on it (WM_TIMER).
		PageWorlds[Id] = PageWorld{Rect, Callback, QueryId};
		Callback->Success("{\"id\":" + std::to_string(Id) + ",\"state\":\"starting\"}");
	}
	else if (Command == "world.rect" && Rect.size() == 4)
	{
		const int Id = Body->GetInt("id");
		auto Found = PageWorlds.find(Id);
		if (Found != PageWorlds.end())
		{
			Found->second.Rect = Rect;
		}
		Running->Move(Id, PageToScreen(Rect));
		Callback->Success("{}");
	}
	else if (Command == "world.close")
	{
		const int Id = Body->GetInt("id");
		Running->Close(Id);
		PageWorlds.erase(Id);
		Log(L"[worlds] %d closed", Id);
		Callback->Success("{}");
	}
	else if (Command == "window.minimize")
	{
		ShowWindow(Window, SW_MINIMIZE);
		Callback->Success("{}");
	}
	else if (Command == "window.maximize")
	{
		ShowWindow(Window, IsZoomed(Window) ? SW_RESTORE : SW_MAXIMIZE);
		Callback->Success(IsZoomed(Window) ? "{\"maximized\":true}" : "{\"maximized\":false}");
	}
	else if (Command == "window.state")
	{
		Callback->Success(IsZoomed(Window) ? "{\"maximized\":true}" : "{\"maximized\":false}");
	}
	else if (Command == "window.close")
	{
		Callback->Success("{}");
		PostMessageW(Window, WM_CLOSE, 0, 0);
	}
	else if (Command == "fab.open")
	{
		const std::string Url = Body->HasKey("url") ? Body->GetString("url").ToString() : CefString(FabWindow::HomeUrl).ToString();
		// The Fab window gives its page the Fab plugin's API (sign-in, installs): it shows Fab's own pages only.
		if (!IsFabPage(Url))
		{
			Callback->Failure(5, "fab.open takes a page of https://www.fab.com");
			return true;
		}
		OpenFab(CefString(Url).ToWString(), false);
		Log(L"[fab] open %s", CefString(Url).ToWString().c_str());
		Callback->Success("{}");
	}
	else
	{
		Callback->Failure(4, "unknown command " + Command);
	}
	return true;
}
