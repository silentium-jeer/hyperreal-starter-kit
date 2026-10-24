#pragma once

#include "CoreMinimal.h"
#include "InputCoreTypes.h"
#include "UObject/Object.h"
#include "VgeUI.generated.h"

class IWebBrowserWindow;
class SWebBrowser;
class SWidget;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FVgeUIMessage, const FString&, Json);

// HTML/CSS UI drawn by the engine's embedded browser (CEF) as a transparent overlay on the game viewport.
// The page talks to the game through this object, bound into the page as window.ue.vge:
//   page -> game: window.ue.vge.post(json)        game listens to OnMessage
//   game -> page: Send(json)                          page receives window.__vgeReceive(message)
// The page reports the rectangles of its interactive elements (window.ue.vge.setinteractiverects);
// the cursor over one of them goes to the browser, anywhere else to the game.
// A pointer the game draws itself (the system cursor captured and hidden) reaches the page through PointerMove,
// PointerButton and PointerWheel: the browser gets them as real mouse input (hover, drag, trusted events).
UCLASS()
class VIBEGAMEENGINE_API UVgeUI : public UObject
{
	GENERATED_BODY()

public:
	UPROPERTY(BlueprintAssignable, Category = "Vge|UI")
	FVgeUIMessage OnMessage;

	// Shows the overlay with the page at Url, or navigates the existing overlay there.
	UFUNCTION(BlueprintCallable, Category = "Vge|UI")
	void Show(const FString& Url);

	UFUNCTION(BlueprintCallable, Category = "Vge|UI")
	void Hide();

	UFUNCTION(BlueprintCallable, Category = "Vge|UI")
	void Send(const FString& Json);

	UFUNCTION(BlueprintCallable, Category = "Vge|UI")
	bool IsShown() const { return Overlay.IsValid(); }

	// Position in game viewport pixels (as PlayerController.GetMousePosition gives them).
	UFUNCTION(BlueprintCallable, Category = "Vge|UI")
	void PointerMove(FVector2D Position);

	// Button: 0 left, 1 right, 2 middle.
	UFUNCTION(BlueprintCallable, Category = "Vge|UI")
	void PointerButton(FVector2D Position, int32 Button, bool bDown);

	UFUNCTION(BlueprintCallable, Category = "Vge|UI")
	void PointerWheel(FVector2D Position, float Delta);

	// Called by the page.
	UFUNCTION()
	void Post(const FString& Json);

	// Called by the page: {"width": innerWidth, "rects": [[x, y, w, h], ...]} in CSS pixels.
	UFUNCTION()
	void SetInteractiveRects(const FString& Json);

private:
	bool IsCursorOverInteractive() const;
	enum class EPointer : uint8 { Move, Down, Up, Wheel };
	void SendPointer(EPointer Kind, FVector2D Position, const FKey& Button, float WheelDelta);

	TSharedPtr<SWebBrowser> Browser;
	TSharedPtr<IWebBrowserWindow> Window;
	TSet<FKey> PressedButtons;
	FVector2D LastPointer = FVector2D::ZeroVector;
	TSharedPtr<SWidget> Overlay;
	TArray<FBox2f> InteractiveRects;
	float PageWidth = 0.f;
};
