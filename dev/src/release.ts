// Release entry: `npm run build` bundles it with everything it imports into Content/JavaScript/vge/game.js,
// which a Shipping game runs instead of the dev bootstrap (UVgeGameInstance::StartGameInstance).
import './app/release-globals';
import './app/program';
