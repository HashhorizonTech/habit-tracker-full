import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { BADGES, formatBadgeDate, openBadgeModal, type BadgeDef, type BadgeProgress } from '@/lib/badges';
import { fonts } from '@/theme/tokens';
import { BadgeCoin } from './BadgeCoin';

const MIN_CELL = 100;
const COL_GAP = 12;
const ROW_GAP = 22;

const BadgeCell = memo(function BadgeCell({ def, p, width }: { def: BadgeDef; p: BadgeProgress; width: number }) {
  const sub = p.unlocked ? (p.unlockedAt ? formatBadgeDate(p.unlockedAt) : 'Today') : `${p.have} / ${p.need}`;
  const a11y = p.unlocked ? `${def.name}, unlocked ${sub}` : `${def.name}, ${p.have} of ${p.need}`;
  return (
    <PressableScale
      style={[styles.cell, { width }]}
      scaleTo={0.94}
      onPress={() => openBadgeModal(def.id)}
      accessibilityLabel={a11y}
      accessibilityHint="Shows badge details"
    >
      <BadgeCoin icon={def.icon} unlocked={p.unlocked} progress={p.have / p.need} lockPip />
      <Text variant="bodyStrong" align="center" style={styles.name} numberOfLines={2}>
        {def.name}
      </Text>
      <Text variant="small" color="ink3" align="center" tabular style={styles.sub}>
        {sub}
      </Text>
    </PressableScale>
  );
});

/** Auto-fill grid of badge coins, minmax(100px, 1fr): ~3 per row on phones, more on tablets. */
export function BadgeGrid({ progress, width }: { progress: BadgeProgress[]; width: number }) {
  const cols = Math.max(3, Math.floor((width + COL_GAP) / (MIN_CELL + COL_GAP)));
  const cell = Math.floor((width - COL_GAP * (cols - 1)) / cols);
  return (
    <View style={styles.grid}>
      {BADGES.map((def) => {
        const p = progress.find((x) => x.id === def.id);
        return p ? <BadgeCell key={def.id} def={def} p={p} width={cell} /> : null;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: COL_GAP, rowGap: ROW_GAP },
  cell: { alignItems: 'center', gap: 8 },
  name: { fontFamily: fonts.body700, fontSize: 13.5, lineHeight: 17 },
  sub: { fontSize: 12, lineHeight: 15, marginTop: -5 },
});
