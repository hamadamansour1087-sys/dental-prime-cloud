import { AbsoluteFill } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { Background } from "./components/Background";
import { SceneIntro } from "./scenes/SceneIntro";
import { SceneFeature } from "./scenes/SceneFeature";
import { SceneOutro } from "./scenes/SceneOutro";
import { VisualCases } from "./components/VisualCases";
import { VisualFinance } from "./components/VisualFinance";
import { VisualPortals } from "./components/VisualPortals";

// 30s @ 30fps = 900 frames.
// 6 scenes with overlapping fade transitions (12f each, 5 transitions = 60 overlap frames)
// Sum of scene durations: 120 + 180 + 180 + 180 + 180 + 120 = 960  → 960 - 60 = 900 ✓

export const MainVideo: React.FC = () => {
  return (
    <AbsoluteFill>
      <Background />
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={120}>
          <SceneIntro />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={fade()} timing={springTiming({ config: { damping: 200 }, durationInFrames: 12 })} />

        <TransitionSeries.Sequence durationInFrames={180}>
          <SceneFeature
            number="01"
            english="CASE TRACKING"
            arabicTitle="تتبّع الحالات"
            arabicDesc="من الاستلام حتى التسليم — كل مرحلة بوقتها وفنّيها"
            align="right"
          >
            <VisualCases />
          </SceneFeature>
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={fade()} timing={springTiming({ config: { damping: 200 }, durationInFrames: 12 })} />

        <TransitionSeries.Sequence durationInFrames={180}>
          <SceneFeature
            number="02"
            english="FINANCIALS"
            arabicTitle="فواتير وحسابات"
            arabicDesc="فواتير دقيقة، كشف حساب لكل طبيب، ومتابعة التحصيل"
            align="left"
          >
            <VisualFinance />
          </SceneFeature>
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={fade()} timing={springTiming({ config: { damping: 200 }, durationInFrames: 12 })} />

        <TransitionSeries.Sequence durationInFrames={180}>
          <SceneFeature
            number="03"
            english="INVENTORY"
            arabicTitle="إدارة المخزون"
            arabicDesc="تتبّع المواد، الموردين، وفواتير المشتريات بدقة"
            align="right"
          >
            <VisualFinance />
          </SceneFeature>
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={fade()} timing={springTiming({ config: { damping: 200 }, durationInFrames: 12 })} />

        <TransitionSeries.Sequence durationInFrames={180}>
          <SceneFeature
            number="04"
            english="PORTALS"
            arabicTitle="بوابات مخصصة"
            arabicDesc="بوابة للأطباء وتطبيق للمندوبين — تواصل فوري"
            align="left"
          >
            <VisualPortals />
          </SceneFeature>
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={fade()} timing={springTiming({ config: { damping: 200 }, durationInFrames: 12 })} />

        <TransitionSeries.Sequence durationInFrames={120}>
          <SceneOutro />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
