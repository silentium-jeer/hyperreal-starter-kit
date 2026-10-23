# Notices

This repository's own code is under the [MIT License](LICENSE). It does not contain Unreal Engine: the
engine is installed by each user from the Epic Games Launcher under Epic's own license, and the project
is built against that installation (`npm run setup`).

## Unreal Engine

Hyperreal Starter Kit uses Unreal® Engine. Unreal® is a trademark or registered trademark of Epic Games, Inc.
in the United States of America and elsewhere.

Unreal® Engine, Copyright 1998 – 2026, Epic Games, Inc. All rights reserved.

Use of Unreal Engine, including games built with this kit, is governed by the
[Unreal Engine End User License Agreement](https://www.unrealengine.com/eula/unreal). This project is not
affiliated with or endorsed by Epic Games. The stock Mannequin the kit uses is copied by `npm run setup`
from the user's own engine installation (Third Person template resources) and is not distributed here.

## Third-party software in this repository

| Component | Where | License |
|---|---|---|
| [Puerts](https://github.com/Tencent/puerts) (Tencent) | `Plugins/Puerts` | BSD 3-Clause, see [`Plugins/Puerts/LICENSE`](Plugins/Puerts/LICENSE) |
| [V8](https://v8.dev) 11.8.172, binaries from [puerts/backend-v8](https://github.com/puerts/backend-v8) | downloaded by `npm run setup` into `%USERPROFILE%\.vge\V8\v8_11.8.172`, linked into the shared runtime as `Plugins/Puerts/ThirdParty/v8_11.8.172` | BSD 3-Clause, see [`Plugins/Puerts/ThirdParty/LICENSE.v8`](Plugins/Puerts/ThirdParty/LICENSE.v8) |
| [libffi](https://github.com/libffi/libffi), headers and prebuilt libraries, as shipped with Puerts | `Plugins/Puerts/ThirdParty/Include/ffi`, `Plugins/Puerts/ThirdParty/Library/ffi` | MIT ([license](https://github.com/libffi/libffi/blob/master/LICENSE)) |
| [Asio](https://think-async.com/Asio/), as shipped with Puerts | `Plugins/Puerts/ThirdParty/Include/asio` | Boost Software License 1.0 ([license](https://www.boost.org/LICENSE_1_0.txt)) |
| [WebSocket++](https://github.com/zaphoyd/websocketpp), as shipped with Puerts | `Plugins/Puerts/ThirdParty/Include/websocketpp` | BSD 3-Clause ([license](https://github.com/zaphoyd/websocketpp/blob/master/COPYING)) |
| [wasm3](https://github.com/wasm3/wasm3), as shipped with Puerts | `Plugins/Puerts/Source/WasmCore/ThirdPart/wasm3` | MIT ([license](https://github.com/wasm3/wasm3/blob/main/LICENSE)) |
| The UI kit, app shell and their Vite plugin from [web-starter-kit](https://github.com/vibegameengine/web-starter-kit) (Vibe Game Engine) | `dev/ui`, `dev/vite/bootstrapAssetRegistryPlugin.ts`, `dev/vite/devLeanTransportPlugin.ts` | MIT |
| Blender skills vendored from [RobLe3/cc-blender-skill](https://github.com/RobLe3/cc-blender-skill) | `agents/skills/blender-*`, `agents/skills/text-to-blender` | MIT, see [`agents/skills/text-to-blender/ROBLE3-LICENSE.txt`](agents/skills/text-to-blender/ROBLE3-LICENSE.txt) |

npm dependencies of `dev/` keep their own licenses (`dev/node_modules/*/LICENSE`).

The packaged game also contains software that ships with Unreal Engine itself, among them the Chromium
Embedded Framework used for the in-game HTML UI; its license is in the engine installation at
`Engine/Source/ThirdParty/Licenses/CEF3_Chromium_License.txt`. The dev shell (`shell/src`) is built against
that same CEF from the user's engine installation, and `npm run setup` copies its runtime next to the shell
executable in the shared runtime's `Build/Shell`; none of it is in this repository.
