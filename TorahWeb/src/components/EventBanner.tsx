import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import type { EventFlier } from '../types';

interface EventBannerProps {
  event: EventFlier | null;
  /** Called with the linked video id when a past event with a recording is tapped. */
  onTapVideo: (videoContentId: string) => void;
}

// Lexicographic compare is correct on YYYY-MM-DD strings and sidesteps the
// timezone surprises that come from `new Date('2026-06-20').getTime()`.
const todayIso = () => new Date().toISOString().slice(0, 10);

const EventBanner: React.FC<EventBannerProps> = ({ event, onTapVideo }) => {
  // Aspect ratio is resolved from the image's natural dimensions so we don't
  // crop or letterbox the publisher's flier. Hold the render until we know
  // the ratio — the alternative is a layout snap on first paint.
  const [aspect, setAspect] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!event) return;
    setAspect(null);
    setFailed(false);
    Image.getSize(
      event.flierUrl,
      (w, h) => {
        if (w > 0 && h > 0) setAspect(w / h);
      },
      () => setFailed(true),
    );
  }, [event]);

  const { isPast, hasVideo } = useMemo(() => {
    if (!event) return { isPast: false, hasVideo: false };
    const past = event.eventDate < todayIso();
    return { isPast: past, hasVideo: past && !!event.videoContentId };
  }, [event]);

  if (!event || failed || !aspect) return null;
  // Past event with no recording: the flier is no longer current and there's
  // nothing to link to, so the banner hides itself rather than mislead.
  if (isPast && !event.videoContentId) return null;

  const image = (
    <Image
      source={{ uri: event.flierUrl }}
      style={[styles.image, { aspectRatio: aspect }]}
      accessibilityIgnoresInvertColors
    />
  );

  if (hasVideo) {
    return (
      <Pressable
        accessibilityRole="imagebutton"
        accessibilityLabel={`${event.title} — play recording`}
        onPress={() => onTapVideo(event.videoContentId!)}
        android_ripple={{ color: 'rgba(0,0,0,0.08)', borderless: false }}
        style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}>
        {image}
      </Pressable>
    );
  }

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={event.title}
      style={styles.wrap}>
      {image}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  image: {
    width: '100%',
  },
  pressed: {
    opacity: 0.92,
  },
});

export default EventBanner;
