#include "VgeFab.h"

#include "AssetRegistry/AssetRegistryModule.h"
#include "Containers/Ticker.h"
#include "HttpModule.h"
#include "IEOSSDKManager.h"
#include "Interfaces/IHttpResponse.h"
#include "Interfaces/IPluginManager.h"
#include "Misc/PackageName.h"
#include "Misc/Paths.h"
#include "Modules/ModuleManager.h"
#include "UObject/SoftObjectPath.h"
#include "UObject/UnrealType.h"
#include "eos_auth.h"
#include "eos_sdk.h"

// The engine Fab plugin's loader of its BuildPatchInstallerLib (header only; the kit's Build.cs adds its folder).
#include "Importers/BuildPatchInstallerLibHelper.h"

DEFINE_LOG_CATEGORY_STATIC(LogVgeFab, Log, All);

namespace
{
	using VgeFab::FReply;

	TSharedRef<FJsonObject> Error(const FString& Message)
	{
		UE_LOGF(LogVgeFab, Error, "%ls", *Message);
		TSharedRef<FJsonObject> Result = MakeShared<FJsonObject>();
		Result->SetStringField(TEXT("error"), Message);
		return Result;
	}

	// ---- Sign-in (FabAuthentication.cpp) ----

	struct FAuthState
	{
		IEOSPlatformHandlePtr Platform;
		EOS_HAuth Auth = nullptr;
		EOS_EpicAccountId Account = nullptr;
		bool bPersistTried = false;
		bool bPersistRunning = false;
		bool bPortalRunning = false;
		TArray<FReply> WaitingForPersist;
		TArray<FReply> WaitingForPortal;
	};

	FAuthState& Auth()
	{
		static FAuthState State;
		return State;
	}

	// A string field of the Fab plugin's FEosConstantsProd, read through reflection: UEosConstants is the plugin's
	// own class (FabAuthentication.h), not exported.
	FString ConstantOf(const UObject* Constants, const FStructProperty* Prod, const TCHAR* Name)
	{
		const FStrProperty* Field = FindFProperty<FStrProperty>(Prod->Struct, Name);
		return Field ? Field->GetPropertyValue_InContainer(Prod->ContainerPtrToValuePtr<void>(Constants)) : FString();
	}

	// FabAuthentication::Init with the Prod environment, the plugin's default (UFabSettings::Environment).
	FString CreatePlatform()
	{
		FAuthState& State = Auth();
		if (State.Platform)
		{
			return FString();
		}
		IEOSSDKManager* SDKManager = IEOSSDKManager::Get();
		if (!SDKManager || !SDKManager->IsInitialized())
		{
			return TEXT("the EOS SDK is not initialized (EOSShared)");
		}
		const UObject* Constants = FSoftObjectPath(TEXT("/Fab/Data/FabEos.FabEos")).TryLoad();
		const FStructProperty* Prod = Constants ? FindFProperty<FStructProperty>(Constants->GetClass(), TEXT("Prod")) : nullptr;
		if (!Prod)
		{
			return TEXT("the Fab plugin's EOS constants (/Fab/Data/FabEos) could not be loaded; is the engine's Fab plugin enabled?");
		}
		const FTCHARToUTF8 ProductId(*ConstantOf(Constants, Prod, TEXT("ProductId")));
		const FTCHARToUTF8 SandboxId(*ConstantOf(Constants, Prod, TEXT("SandboxId")));
		const FTCHARToUTF8 DeploymentId(*ConstantOf(Constants, Prod, TEXT("DeploymentId")));
		const FTCHARToUTF8 ClientId(*ConstantOf(Constants, Prod, TEXT("ClientCredentialsId")));
		const FTCHARToUTF8 ClientSecret(*ConstantOf(Constants, Prod, TEXT("ClientCredentialsSecret")));
		const FTCHARToUTF8 EncryptionKey(*ConstantOf(Constants, Prod, TEXT("EncryptionKey")));

		EOS_Platform_Options PlatformOptions = {};
		PlatformOptions.ApiVersion = EOS_PLATFORM_OPTIONS_API_LATEST;
		PlatformOptions.ClientCredentials.ClientId = ClientId.Get();
		PlatformOptions.ClientCredentials.ClientSecret = ClientSecret.Get();
		PlatformOptions.ProductId = ProductId.Get();
		PlatformOptions.DeploymentId = DeploymentId.Get();
		PlatformOptions.SandboxId = SandboxId.Get();
		PlatformOptions.EncryptionKey = EncryptionKey.Get();
		PlatformOptions.bIsServer = EOS_FALSE;
		PlatformOptions.Flags = EOS_PF_DISABLE_OVERLAY;
		PlatformOptions.Reserved = nullptr;
		PlatformOptions.TickBudgetInMilliseconds = 0;
		PlatformOptions.IntegratedPlatformOptionsContainerHandle = nullptr;
		State.Platform = SDKManager->CreatePlatform(PlatformOptions);
		if (!State.Platform)
		{
			return TEXT("EOS_Platform_Create failed for the Fab product; see the service log (LogEOSShared)");
		}
		State.Auth = EOS_Platform_GetAuthInterface(*State.Platform);
		return FString();
	}

	TSharedRef<FJsonObject> Tokens()
	{
		FAuthState& State = Auth();
		TSharedRef<FJsonObject> Result = MakeShared<FJsonObject>();
		FString AccessToken;
		FString RefreshToken;
		EOS_Auth_Token* Token = nullptr;
		EOS_Auth_CopyUserAuthTokenOptions Options = {};
		Options.ApiVersion = EOS_AUTH_COPYUSERAUTHTOKEN_API_LATEST;
		if (State.Auth && State.Account && EOS_Auth_CopyUserAuthToken(State.Auth, &Options, State.Account, &Token) == EOS_EResult::EOS_Success)
		{
			AccessToken = UTF8_TO_TCHAR(Token->AccessToken);
			RefreshToken = UTF8_TO_TCHAR(Token->RefreshToken);
			EOS_Auth_Token_Release(Token);
		}
		Result->SetStringField(TEXT("accessToken"), AccessToken);
		Result->SetStringField(TEXT("refreshToken"), RefreshToken);
		return Result;
	}

	void Login(EOS_ELoginCredentialType Type, EOS_Auth_OnLoginCallback Done)
	{
		EOS_Auth_Credentials Credentials = {};
		Credentials.ApiVersion = EOS_AUTH_CREDENTIALS_API_LATEST;
		Credentials.Type = Type;
		EOS_Auth_LoginOptions Options = {};
		Options.ApiVersion = EOS_AUTH_LOGIN_API_LATEST;
		Options.Credentials = &Credentials;
		EOS_Auth_Login(Auth().Auth, &Options, nullptr, Done);
	}

	void EOS_CALL OnPersistLogin(const EOS_Auth_LoginCallbackInfo* Data)
	{
		FAuthState& State = Auth();
		State.bPersistRunning = false;
		if (Data->ResultCode == EOS_EResult::EOS_Success)
		{
			State.Account = Data->LocalUserId;
			UE_LOGF(LogVgeFab, Display, "Signed in from the persistent auth");
		}
		else
		{
			UE_LOGF(LogVgeFab, Display, "No persistent sign-in: %ls", UTF8_TO_TCHAR(EOS_EResult_ToString(Data->ResultCode)));
		}
		for (const FReply& Reply : TArray<FReply>(MoveTemp(State.WaitingForPersist)))
		{
			Reply(Tokens());
		}
	}

	void EOS_CALL OnPortalLogin(const EOS_Auth_LoginCallbackInfo* Data)
	{
		FAuthState& State = Auth();
		State.bPortalRunning = false;
		const bool bSignedIn = Data->ResultCode == EOS_EResult::EOS_Success;
		if (bSignedIn)
		{
			State.Account = Data->LocalUserId;
			UE_LOGF(LogVgeFab, Display, "Signed in through the account portal");
		}
		const FString Code = UTF8_TO_TCHAR(EOS_EResult_ToString(Data->ResultCode));
		for (const FReply& Reply : TArray<FReply>(MoveTemp(State.WaitingForPortal)))
		{
			Reply(bSignedIn ? Tokens() : Error(FString::Printf(TEXT("sign-in failed: %s"), *Code)));
		}
	}

	TArray<FReply>& WaitingForLogout()
	{
		static TArray<FReply> Waiting;
		return Waiting;
	}

	void EOS_CALL OnDeletePersistentAuth(const EOS_Auth_DeletePersistentAuthCallbackInfo* Data)
	{
		UE_LOGF(LogVgeFab, Display, "Persistent auth deleted: %ls", UTF8_TO_TCHAR(EOS_EResult_ToString(Data->ResultCode)));
		for (const FReply& Reply : TArray<FReply>(MoveTemp(WaitingForLogout())))
		{
			Reply(MakeShared<FJsonObject>());
		}
	}

	void DeletePersistentAuth()
	{
		EOS_Auth_DeletePersistentAuthOptions Options = {};
		Options.ApiVersion = EOS_AUTH_DELETEPERSISTENTAUTH_API_LATEST;
		EOS_Auth_DeletePersistentAuth(Auth().Auth, &Options, nullptr, OnDeletePersistentAuth);
	}

	void EOS_CALL OnLogout(const EOS_Auth_LogoutCallbackInfo* Data)
	{
		Auth().Account = nullptr;
		DeletePersistentAuth();
	}

	void Token(FReply Reply)
	{
		FAuthState& State = Auth();
		if (const FString Failure = CreatePlatform(); !Failure.IsEmpty())
		{
			Reply(Error(Failure));
			return;
		}
		if (State.Account || State.bPersistTried)
		{
			Reply(Tokens());
			return;
		}
		State.WaitingForPersist.Add(MoveTemp(Reply));
		if (!State.bPersistRunning)
		{
			State.bPersistTried = true;
			State.bPersistRunning = true;
			Login(EOS_ELoginCredentialType::EOS_LCT_PersistentAuth, OnPersistLogin);
		}
	}

	void PortalLogin(FReply Reply)
	{
		FAuthState& State = Auth();
		if (const FString Failure = CreatePlatform(); !Failure.IsEmpty())
		{
			Reply(Error(Failure));
			return;
		}
		State.WaitingForPortal.Add(MoveTemp(Reply));
		if (!State.bPortalRunning)
		{
			State.bPortalRunning = true;
			Login(EOS_ELoginCredentialType::EOS_LCT_AccountPortal, OnPortalLogin);
		}
	}

	void Logout(FReply Reply)
	{
		FAuthState& State = Auth();
		if (const FString Failure = CreatePlatform(); !Failure.IsEmpty())
		{
			Reply(Error(Failure));
			return;
		}
		WaitingForLogout().Add(MoveTemp(Reply));
		if (State.Account)
		{
			EOS_Auth_LogoutOptions Options = {};
			Options.ApiVersion = EOS_AUTH_LOGOUT_API_LATEST;
			Options.LocalUserId = State.Account;
			EOS_Auth_Logout(State.Auth, &Options, nullptr, OnLogout);
		}
		else
		{
			DeletePersistentAuth();
		}
	}

	// ---- Installs (FabDownloader.cpp, PackImportWorkflow.cpp, PluginInstallWorkflow.cpp) ----

	BpiLib::IBpiLib* BuildPatchLib()
	{
		static TUniquePtr<BpiLib::IBpiLib> Lib;
		if (!Lib)
		{
			const TSharedPtr<IPlugin> FabPlugin = IPluginManager::Get().FindPlugin(TEXT("Fab"));
			if (!FabPlugin)
			{
				return nullptr;
			}
			Lib = BpiLib::FBpiLibHelperFactory::Create(FPaths::ConvertRelativePathToFull(FPaths::Combine(FabPlugin->GetBaseDir(), TEXT("ThirdParty"), TEXT("BuildPatchInstallerLib.dll"))));
			if (Lib)
			{
				FTSTicker::GetCoreTicker().AddTicker(FTickerDelegate::CreateLambda([](float Delta)
				{
					Lib->Tick(Delta);
					return true;
				}));
			}
		}
		return Lib.Get();
	}

	bool IsDescriptor(const FString& File, const TCHAR* Extension, const TCHAR* Truncated)
	{
		// The plugin also checks the extension cut short by one character (a BuildPatchServices off-by-one).
		const FString FileExtension = FPaths::GetExtension(File);
		return FileExtension == Extension || FileExtension == Truncated;
	}

	// PackImportWorkflow.cpp CheckForDependencies: the plugins whose classes the pack's assets use and which are not
	// enabled, with the assets that need each.
	TSharedRef<FJsonObject> MissingPlugins(const TArray<FString>& Files, const FString& InstallDir)
	{
		IAssetRegistry& Registry = FAssetRegistryModule::GetRegistry();
		TSet<FString> PackagePaths;
		TArray<FString> PackageNames;
		for (const FString& File : Files)
		{
			FString PackageName;
			if (File.EndsWith(TEXT(".uasset")) && FPackageName::TryConvertFilenameToLongPackageName(FPaths::ConvertRelativePathToFull(InstallDir / File), PackageName))
			{
				PackageNames.Add(PackageName);
				PackagePaths.Add(FPackageName::GetLongPackagePath(PackageName));
			}
		}
		Registry.ScanPathsSynchronous(PackagePaths.Array(), /*bForceRescan*/ true);

		TMap<FString, TArray<TSharedPtr<FJsonValue>>> Needed;
		for (const FString& PackageName : PackageNames)
		{
			TArray<FAssetData> Assets;
			Registry.GetAssetsByPackageName(FName(*PackageName), Assets);
			for (const FAssetData& Asset : Assets)
			{
				const FString ClassPath = Asset.AssetClassPath.ToString();
				FString ModuleName;
				if (!ClassPath.StartsWith(TEXT("/Script/")) || !ClassPath.RightChop(8).Split(TEXT("."), &ModuleName, nullptr) || FModuleManager::Get().IsModuleLoaded(*ModuleName))
				{
					continue;
				}
				for (const TSharedRef<IPlugin>& Plugin : IPluginManager::Get().GetDiscoveredPlugins())
				{
					const bool bOwnsModule = Plugin->GetDescriptor().Modules.ContainsByPredicate([&ModuleName](const FModuleDescriptor& Module)
					{
						return Module.Name.ToString().Equals(ModuleName, ESearchCase::IgnoreCase);
					});
					if (bOwnsModule && !Plugin->IsEnabled())
					{
						Needed.FindOrAdd(Plugin->GetName()).AddUnique(MakeShared<FJsonValueString>(PackageName));
					}
				}
			}
		}
		TSharedRef<FJsonObject> Result = MakeShared<FJsonObject>();
		for (const TPair<FString, TArray<TSharedPtr<FJsonValue>>>& Plugin : Needed)
		{
			Result->SetArrayField(Plugin.Key, Plugin.Value);
		}
		return Result;
	}

	struct FInstall : TSharedFromThis<FInstall>
	{
		FString Kind;
		FString InstallDir;
		FString StagingDir;
		TArray<FString> CloudDirs;
		FReply Reply;
		FReply Progress;
		TArray<FString> Files;
		IBuildInstallerPtr Installer;
		FTSTicker::FDelegateHandle ProgressTicker;
	};

	TArray<TSharedPtr<FInstall>>& Installs()
	{
		static TArray<TSharedPtr<FInstall>> Running;
		return Running;
	}

	void Finish(const TSharedPtr<FInstall>& Install, TSharedRef<FJsonObject> Result)
	{
		if (Install->ProgressTicker.IsValid())
		{
			FTSTicker::RemoveTicker(Install->ProgressTicker);
		}
		Install->Reply(Result);
		Installs().Remove(Install);
	}

	void OnManifest(const TSharedPtr<FInstall>& Install, const TArray<uint8>& ManifestData)
	{
		BpiLib::IBpiLib* Lib = BuildPatchLib();
		BpiLib::FManifestStorage Manifest = Lib->MakeManifestFromData(ManifestData);
		if (!Manifest.IsValid())
		{
			Finish(Install, Error(TEXT("the build manifest is not valid")));
			return;
		}
		Install->Files = Manifest.GetBuildFileList();
		const bool bHasProject = Install->Files.ContainsByPredicate([](const FString& File) { return IsDescriptor(File, TEXT("uproject"), TEXT("uprojec")); });
		const bool bHasPlugin = Install->Files.ContainsByPredicate([](const FString& File) { return IsDescriptor(File, TEXT("uplugin"), TEXT("uplugi")); });
		if (Install->Kind == TEXT("pack") && (bHasProject || bHasPlugin))
		{
			Finish(Install, Error(TEXT("not an asset pack: the build holds a .uproject or .uplugin file")));
			return;
		}
		if (Install->Kind == TEXT("plugin") && !bHasPlugin)
		{
			Finish(Install, Error(TEXT("not a plugin: the build holds no .uplugin file")));
			return;
		}

		BuildPatchServices::FBuildInstallerConfiguration Configuration({});
		Configuration.InstallDirectory = Install->InstallDir;
		Configuration.StagingDirectory = Install->StagingDir;
		Configuration.InstallMode = BuildPatchServices::EInstallMode::NonDestructiveInstall;
		Configuration.CloudDirectories = Install->CloudDirs;
		TWeakPtr<FInstall> WeakInstall = Install;
		Install->Installer = Lib->CreateInstaller(Manifest, Configuration, FBuildPatchInstallerDelegate::CreateLambda([WeakInstall](const IBuildInstallerRef& Installer)
		{
			const TSharedPtr<FInstall> Done = WeakInstall.Pin();
			if (!Done)
			{
				return;
			}
			const FBuildInstallStats Stats = BuildPatchLib()->GetBuildStats(Installer);
			if (Installer->IsCanceled() || !Stats.ProcessSuccess)
			{
				Finish(Done, Error(FString::Printf(TEXT("the download failed (BuildPatchServices failure type %d)"), static_cast<int32>(Stats.FailureType))));
				return;
			}
			TSharedRef<FJsonObject> Result = MakeShared<FJsonObject>();
			TArray<TSharedPtr<FJsonValue>> Files;
			for (const FString& File : Done->Files)
			{
				Files.Add(MakeShared<FJsonValueString>(File));
			}
			Result->SetArrayField(TEXT("files"), Files);
			Result->SetNumberField(TEXT("downloaded"), static_cast<double>(Stats.TotalDownloadedData));
			if (Done->Kind == TEXT("pack"))
			{
				Result->SetObjectField(TEXT("missingPlugins"), MissingPlugins(Done->Files, Done->InstallDir));
			}
			Finish(Done, Result);
		})).ToSharedPtr();

		Install->ProgressTicker = FTSTicker::GetCoreTicker().AddTicker(FTickerDelegate::CreateLambda([WeakInstall](float)
		{
			const TSharedPtr<FInstall> Running = WeakInstall.Pin();
			if (!Running || !Running->Installer)
			{
				return false;
			}
			const IBuildInstallerRef Installer = Running->Installer.ToSharedRef();
			const int64 Total = BuildPatchLib()->GetTotalDownloadRequired(Installer);
			const int64 Downloaded = BuildPatchLib()->GetTotalDownloaded(Installer);
			TSharedRef<FJsonObject> Progress = MakeShared<FJsonObject>();
			Progress->SetStringField(TEXT("stage"), TEXT("downloading"));
			Progress->SetNumberField(TEXT("downloaded"), static_cast<double>(Downloaded));
			Progress->SetNumberField(TEXT("total"), static_cast<double>(Total));
			Progress->SetNumberField(TEXT("percent"), Total > 0 ? 100.0 * static_cast<double>(Downloaded) / static_cast<double>(Total) : 0.0);
			Running->Progress(Progress);
			return true;
		}), 1.0f);

		Install->Installer->StartInstallation();
	}

	void StartInstall(const TSharedPtr<FJsonObject>& Request, FReply Reply, FReply Progress)
	{
		if (!BuildPatchLib())
		{
			Reply(Error(TEXT("the Fab plugin's BuildPatchInstallerLib could not be loaded")));
			return;
		}
		TSharedPtr<FInstall> Install = MakeShared<FInstall>();
		Install->Kind = Request->GetStringField(TEXT("kind"));
		Install->InstallDir = Request->GetStringField(TEXT("installDir"));
		Install->StagingDir = Request->GetStringField(TEXT("stagingDir"));
		Request->TryGetStringArrayField(TEXT("baseUrls"), Install->CloudDirs);
		Install->Reply = MoveTemp(Reply);
		Install->Progress = MoveTemp(Progress);
		Installs().Add(Install);

		const TSharedRef<IHttpRequest, ESPMode::ThreadSafe> ManifestRequest = FHttpModule::Get().CreateRequest();
		ManifestRequest->SetURL(Request->GetStringField(TEXT("manifestUrl")));
		ManifestRequest->OnProcessRequestComplete().BindLambda([Install](FHttpRequestPtr, FHttpResponsePtr Response, bool bComplete)
		{
			if (!bComplete || !Response.IsValid() || Response->GetResponseCode() < 200 || Response->GetResponseCode() >= 300)
			{
				Finish(Install, Error(FString::Printf(TEXT("the build manifest did not download (HTTP %d)"), Response.IsValid() ? Response->GetResponseCode() : 0)));
				return;
			}
			OnManifest(Install, Response->GetContent());
		});
		ManifestRequest->ProcessRequest();
	}
}

bool VgeFab::Handle(const FString& Command, const TSharedPtr<FJsonObject>& Request, FReply Reply, FReply Progress)
{
	if (Command == TEXT("fab-token"))
	{
		Token(MoveTemp(Reply));
	}
	else if (Command == TEXT("fab-login"))
	{
		PortalLogin(MoveTemp(Reply));
	}
	else if (Command == TEXT("fab-logout"))
	{
		Logout(MoveTemp(Reply));
	}
	else if (Command == TEXT("fab-install"))
	{
		StartInstall(Request, MoveTemp(Reply), MoveTemp(Progress));
	}
	else
	{
		return false;
	}
	return true;
}
