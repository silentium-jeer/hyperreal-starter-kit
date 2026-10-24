#pragma once

#include <string>

// True for a page of the Fab website itself (https://www.fab.com/..., https://fab.com/...): the only pages that get
// window.ue.fab and whose calls a Fab window answers.
inline bool IsFabPage(const std::string& Url)
{
	for (const char* Origin : { "https://www.fab.com", "https://fab.com" })
	{
		const size_t Length = std::char_traits<char>::length(Origin);
		if (Url.compare(0, Length, Origin) == 0 && (Url.size() == Length || Url[Length] == '/' || Url[Length] == '?' || Url[Length] == '#'))
		{
			return true;
		}
	}
	return false;
}

// The script the render process runs in a Fab window's page as its JavaScript context is created, before the page's
// own scripts (Main.cpp ShellApp::OnContextCreated): window.ue.fab, the way the engine's CEF binding exposes the Fab
// plugin's UFabBrowserApi (BindUObject("fab", ..., permanent) -> window.ue.fab, CEFJSScripting.cpp). Every method of
// the class is there under its lowercased name and returns a Promise of the function's return value. A JS function
// passed in (an FWebJSFunction field, RegisterCallbacks) stays here under an id; the shell calls it back with
// window.__vgeFab.invoke(id, args). The calls go over a message router of their own, window.__vgeFabQuery
// (FabQueryFunction; FabWindow::OnQuery answers it): a Fab page never gets the shell page's window.cefQuery.
//
// The names are UFabBrowserApi's UFUNCTIONs (Engine/Plugins/Fab/Source/Fab/Private/FabBrowserApi.h) and UObject's
// ExecuteUbergraph, which the binding lists too.
inline constexpr char FabQueryFunction[] = "__vgeFabQuery";
inline constexpr char FabQueryCancelFunction[] = "__vgeFabQueryCancel";

inline constexpr char FabBridgeScript[] = R"JS(
(() => {
  const query = window.__vgeFabQuery;
  if (!query) return;
  const functions = new Map();
  let nextFunction = 1;
  const encode = (value) => {
    if (typeof value === 'function') {
      const id = nextFunction++;
      functions.set(id, value);
      return { $function: id };
    }
    if (Array.isArray(value)) return value.map(encode);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)]));
    return value;
  };
  const call = (method, args) =>
    new Promise((resolve, reject) => {
      query({
        request: JSON.stringify({ method, args: encode(args) }),
        onSuccess: (response) => resolve(response === '' ? undefined : JSON.parse(response)),
        onFailure: (code, message) => reject(new Error(message)),
      });
    });
  const methods = [
    'registercallbacks', 'addtoproject', 'installtoproject', 'installtoengine', 'dragstart', 'ondraginfosuccess',
    'ondraginfofailure', 'login', 'logout', 'getauthtoken', 'getrefreshtoken', 'openpluginsettings', 'getsettings',
    'setpreferredqualitytier', 'getapiversion', 'openinnewtab', 'openurlinbrowser', 'copytoclipboard', 'pluginopened',
    'geturl', 'executeubergraph',
  ];
  const fab = {};
  for (const method of methods) fab[method] = (...args) => call(method, args);
  window.ue = window.ue || {};
  window.ue.fab = fab;
  Object.defineProperty(window, '__vgeFab', { value: { invoke: (id, args) => functions.get(id)?.(...args) } });
})();
)JS";
