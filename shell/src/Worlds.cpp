#include "Worlds.h"

#include <cwchar>
#include <utility>

namespace
{
	// Unreal's top-level window class (FWindowsWindow::AppWindowClass).
	constexpr wchar_t UnrealWindowClass[] = L"UnrealWindow";

	struct FindWindowOf
	{
		DWORD ProcessId;
		HWND Found;
	};

	BOOL CALLBACK FindProcessWindow(HWND Window, LPARAM Param)
	{
		auto* Search = reinterpret_cast<FindWindowOf*>(Param);
		DWORD ProcessId = 0;
		GetWindowThreadProcessId(Window, &ProcessId);
		wchar_t ClassName[64] = {};
		GetClassNameW(Window, ClassName, 64);
		if (ProcessId == Search->ProcessId && IsWindowVisible(Window) && wcscmp(ClassName, UnrealWindowClass) == 0)
		{
			Search->Found = Window;
			return FALSE;
		}
		return TRUE;
	}
}

Worlds::Worlds(std::wstring InGameExe, std::wstring InDevServer, std::wstring InLogDir)
	: GameExe(std::move(InGameExe))
	, DevServer(std::move(InDevServer))
	, LogDir(std::move(InLogDir))
{
	Job = CreateJobObjectW(nullptr, nullptr);
	JOBOBJECT_EXTENDED_LIMIT_INFORMATION Limits{};
	Limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
	SetInformationJobObject(Job, JobObjectExtendedLimitInformation, &Limits, sizeof(Limits));
}

Worlds::~Worlds()
{
	CloseAll();
	CloseHandle(Job);
}

int Worlds::Open(const std::wstring& Scene, const RECT& Rect)
{
	const int Id = NextId++;
	std::wstring LogName = Scene;
	for (wchar_t& Char : LogName)
	{
		if (Char == L'/' || Char == L'\\')
		{
			Char = L'-';
		}
	}
	// The window opens where it will stay, borderless the engine's own way: the project setting
	// bUseBorderlessWindow (UGameEngine::CreateGameWindow), given on the command line as a config override.
	wchar_t CommandLine[2048];
	swprintf_s(CommandLine, L"\"%s\" -Scene=%s -DevServer=%s -windowed -WinX=%ld -WinY=%ld -ResX=%ld -ResY=%ld"
		L" -ini:Game:[/Script/EngineSettings.GeneralProjectSettings]:bUseBorderlessWindow=True -abslog=\"%s\\world-%s-%lu.log\"",
		GameExe.c_str(), Scene.c_str(), DevServer.c_str(), Rect.left, Rect.top, Rect.right - Rect.left, Rect.bottom - Rect.top,
		LogDir.c_str(), LogName.c_str(), GetTickCount());

	World NewWorld;
	NewWorld.Scene = Scene;
	NewWorld.Rect = Rect;
	STARTUPINFOW Startup{sizeof(Startup)};
	if (!CreateProcessW(nullptr, CommandLine, nullptr, nullptr, FALSE, CREATE_SUSPENDED, nullptr, nullptr, &Startup, &NewWorld.Process))
	{
		return 0;
	}
	AssignProcessToJobObject(Job, NewWorld.Process.hProcess);
	ResumeThread(NewWorld.Process.hThread);
	Running.emplace(Id, NewWorld);
	return Id;
}

void Worlds::Move(int Id, const RECT& Rect)
{
	auto Found = Running.find(Id);
	if (Found == Running.end())
	{
		return;
	}
	Found->second.Rect = Rect;
	if (Found->second.Window && LastShell)
	{
		Place(Found->second, LastShell);
	}
}

void Worlds::Close(int Id)
{
	auto Found = Running.find(Id);
	if (Found == Running.end())
	{
		return;
	}
	// Off the screen at once: the process takes a moment to go, and its window must not hang there empty.
	if (Found->second.Window)
	{
		ShowWindow(Found->second.Window, SW_HIDE);
	}
	TerminateProcess(Found->second.Process.hProcess, 0);
	CloseHandle(Found->second.Process.hProcess);
	CloseHandle(Found->second.Process.hThread);
	Running.erase(Found);
}

void Worlds::CloseAll()
{
	while (!Running.empty())
	{
		Close(Running.begin()->first);
	}
}

std::vector<Worlds::Change> Worlds::Poll(HWND Shell)
{
	LastShell = Shell;
	std::vector<Change> Changes;
	for (auto It = Running.begin(); It != Running.end();)
	{
		World& Each = It->second;
		if (WaitForSingleObject(Each.Process.hProcess, 0) == WAIT_OBJECT_0)
		{
			CloseHandle(Each.Process.hProcess);
			CloseHandle(Each.Process.hThread);
			Changes.push_back({It->first, Event::Exited});
			It = Running.erase(It);
			continue;
		}
		if (!Each.Window)
		{
			FindWindowOf Search{Each.Process.dwProcessId, nullptr};
			EnumWindows(FindProcessWindow, reinterpret_cast<LPARAM>(&Search));
			Each.Window = Search.Found;
		}
		if (Each.Window)
		{
			// A world's window is a surface of the shell, without a taskbar button of its own. The game applies
			// its own window settings after the window exists, so the place is checked on every poll.
			const LONG_PTR ExStyle = GetWindowLongPtrW(Each.Window, GWL_EXSTYLE);
			if (ExStyle & WS_EX_APPWINDOW)
			{
				SetWindowLongPtrW(Each.Window, GWL_EXSTYLE, (ExStyle & ~WS_EX_APPWINDOW) | WS_EX_TOOLWINDOW);
			}
			RECT Current;
			GetWindowRect(Each.Window, &Current);
			if (!EqualRect(&Current, &Each.Rect))
			{
				Place(Each, Shell);
			}
			else if (!Each.bReady)
			{
				Each.bReady = true;
				Changes.push_back({It->first, Event::Ready});
			}
		}
		++It;
	}
	return Changes;
}

void Worlds::Place(World& Each, HWND Shell)
{
	const RECT& R = Each.Rect;
	SetWindowPos(Each.Window, Shell, R.left, R.top, R.right - R.left, R.bottom - R.top, SWP_NOACTIVATE | (bVisible ? SWP_SHOWWINDOW : 0));
}

void Worlds::StackBelow(HWND Shell)
{
	LastShell = Shell;
	for (auto& [Id, Each] : Running)
	{
		if (Each.Window)
		{
			Place(Each, Shell);
		}
	}
}

void Worlds::SetVisible(bool bInVisible)
{
	bVisible = bInVisible;
	for (auto& [Id, Each] : Running)
	{
		if (Each.Window)
		{
			ShowWindow(Each.Window, bVisible ? SW_SHOWNOACTIVATE : SW_HIDE);
		}
	}
}

bool Worlds::Owns(HWND Window) const
{
	for (const auto& [Id, Each] : Running)
	{
		if (Each.Window == Window)
		{
			return true;
		}
	}
	return false;
}
