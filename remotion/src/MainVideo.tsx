import { AbsoluteFill } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { Background } from "./components/Background";
import { SceneIntro } from "./scenes/SceneIntro";
import { SceneShot } from "./scenes/SceneShot";
import { SceneOutro } from "./scenes/SceneOutro";

// 30s @ 30fps = 900 frames
// intro 120 + 4×165 + outro 120 = 900 + 5×12 transition overlap → 900 - 60 = 840? recalc:
// 120 + 165 + 165 + 165 + 165 + 120 = 900; 5 transitions × 12 = 60 overlap → final = 840
// Use durations summing to 960 so final = 900: 130 + 175 + 175 + 175 + 175 + 130 = 960; 960-60=900 ✓
export const MainVideo: React.FC = () => {
  return (
    <AbsoluteFill>
      <Background />
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={130}>
          <SceneIntro />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={springTiming({ config: { damping: 200 }, durationInFrames: 12 })} />

        <TransitionSeries.Sequence durationInFrames={175}>
          <SceneShot number="01" english="DASHBOARD" arabicTitle="لوحة التحكم" src="shots/01-dashboard.png" />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={springTiming({ config: { damping: 200 }, durationInFrames: 12 })} />

        <TransitionSeries.Sequence durationInFrames={175}>
          <SceneShot number="02" english="CASES" arabicTitle="إدارة الحالات" src="shots/02-cases.png" />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={springTiming({ config: { damping: 200 }, durationInFrames: 12 })} />

        <TransitionSeries.Sequence durationInFrames={175}>
          <SceneShot number="03" english="DOCTORS" arabicTitle="الأطباء" src="shots/03-doctors.png" />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={springTiming({ config: { damping: 200 }, durationInFrames: 12 })} />

        <TransitionSeries.Sequence durationInFrames={175}>
          <SceneShot number="04" english="CASE DETAILS" arabicTitle="تفاصيل الحالة" src="shots/04-case-detail.png" />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={springTiming({ config: { damping: 200 }, durationInFrames: 12 })} />

        <TransitionSeries.Sequence durationInFrames={130}>
          <SceneOutro />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
