import { loadFont as loadCairo } from "@remotion/google-fonts/Cairo";
import { loadFont as loadPlayfair } from "@remotion/google-fonts/PlayfairDisplay";

export const cairo = loadCairo("normal", { weights: ["400", "700", "900"], subsets: ["arabic", "latin"] }).fontFamily;
export const playfair = loadPlayfair("normal", { weights: ["400", "700"], subsets: ["latin"] }).fontFamily;
