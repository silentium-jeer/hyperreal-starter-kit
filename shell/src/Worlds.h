#pragma once

#include <windows.h>

#include <map>
#include <string>
#include <vector>

// The shell's worlds. A world is the game as it is: a VibeGameEngine.exe process with its own engine world, V8
// and HUD page, opened on one scene. The shell starts one per <GameWorld> the page mounts, borderless, and keeps
// its window exactly under the GameWorld element's rectangle, just below the shell window, so the shell page
// draws its own UI over it. Closing a world ends its process.
class Worlds
{
public:
	enum class Event
	{
		// The world's window is up and in place.
		Ready,
		// The world's process ended on its own (not through Close).
		Exited,
	};
	struct Change
	{
		int Id;
		Event What;
	};

	Worlds(std::wstring GameExe, std::wstring LogDir);
	~Worlds();

	// Starts a world on Scene at Rect (screen pixels). Returns its id, 0 if the process could not start.
	int Open(const std::wstring& Scene, const RECT& Rect);
	void Move(int Id, const RECT& Rect);
	void Close(int Id);
	void CloseAll();

	// Called on a timer: finds the windows of started worlds and keeps them in place, forgets worlds whose
	// process ended. Returns what changed since the last poll.
	std::vector<Change> Poll(HWND Shell);
	// Puts every world's window right below the shell window (after the shell moved or another window came up).
	void StackBelow(HWND Shell);
	void SetVisible(bool bVisible);
	bool Owns(HWND Window) const;

private:
	struct World
	{
		std::wstring Scene;
		PROCESS_INFORMATION Process{};
		HWND Window = nullptr;
		RECT Rect{};
		bool bReady = false;
	};

	void Place(World& World, HWND Shell);

	std::wstring GameExe;
	std::wstring LogDir;
	// Every world process is in this job, which ends them all when the shell process ends however it ends.
	HANDLE Job = nullptr;
	std::map<int, World> Running;
	int NextId = 1;
	HWND LastShell = nullptr;
	bool bVisible = true;
};
