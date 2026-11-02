import { Card, Screen } from '@/components/screen';

export default function AboutScreen() {
  return (
    <Screen
      eyebrow="A little about us"
      title="Simple by design."
      description="We believe a good app should feel easy to use, welcoming, and focused on what matters.">
      <Card title="Our purpose">
        To create a comfortable place for your ideas to grow, with clear information and easy
        navigation at every step.
      </Card>
      <Card title="What matters to us">
        Thoughtful details, a clear layout, and an experience that feels natural from the first
        tap. Small things make a big difference.
      </Card>
      <Card title="Just the beginning">
        This is version 1.0.0. Start with Home, explore at your own pace, and look forward to
        more along the way.
      </Card>
    </Screen>
  );
}
