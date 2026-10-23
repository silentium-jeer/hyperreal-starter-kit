#pragma once

#include "CoreMinimal.h"
#include "UObject/Object.h"
#include "VgeUI.generated.h"

class SWebBrowser;
class SWidget;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FVgeUIMessage, const FString&, Json);

// HTML/CSS UI drawn by the engine's embedded browser (CEF) as a transparent overlay on the game viewport.
// The page talks to the game through this object, bound into the page as window.ue.vge:
//   page -> game: window.ue.vge.post(json)        game listens to OnMessage
//   game -> page: Send(json)                          page receives window.__vgeReceive(message)
// The page reports the rectangles of its interactive elements (window.ue.vge.setinteractiverects);
// the cursor over one of them goes to the browser, anywhere else to the game.
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

	// Called by the page.
	UFUNCTION()
	void Post(const FString& Json);

	// Called by the page: {"width": innerWidth, "rects": [[x, y, w, h], ...]} in CSS pixels.
	UFUNCTION()
	void SetInteractiveRects(const FString& Json);

private:
	bool IsCursorOverInteractive() const;

	TSharedPtr<SWebBrowser> Browser;
	TSharedPtr<SWidget> Overlay;
	TArray<FBox2f> InteractiveRects;
	float PageWidth = 0.f;
};
