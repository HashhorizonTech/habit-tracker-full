import { useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon } from '@/components/icons/Icon';
import { Mascot } from '@/components/illustration';
import { isPlaySubscription, planLabel, renewalLabel } from '@/components/plus/format';
import { BenefitList, celebratePlus } from '@/components/plus/PlusParts';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen } from '@/components/ui/Screen';
import { goBack } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import {
  BILLING_COPY,
  buy,
  canBuy,
  FALLBACK_PRICES,
  initBilling,
  manageSubscription,
  restore,
  simulatePurchase,
  useBilling,
  type Plan,
  type PlanPrice,
} from '@/lib/billing';
import { APP_NAME, LEGAL } from '@/lib/brand';
import { haptic } from '@/lib/haptics';
import { PLUS_CONTEXT, type PlusFrom } from '@/lib/plusFeatures';
import { refreshPlus, usePlus } from '@/store/plus';
import { toast } from '@/store/ui';
import { useTheme } from '@/theme';
import { fonts } from '@/theme/tokens';

const PLANS: Plan[] = ['yearly', 'monthly', 'lifetime'];

const SMALL_PRINT =
  'Cancel anytime in Google Play. Payment is charged to your Google account; subscriptions renew automatically unless cancelled at least 24 hours before the period ends.';

const openLink = (url: string) => WebBrowser.openBrowserAsync(url).catch(() => {});

function ctaLabel(plan: Plan, price: PlanPrice, simulate: boolean) {
  if (simulate) return 'Simulate purchase (dev)';
  if (plan === 'lifetime') return 'Buy once';
  if (plan === 'yearly' && price.trial) return 'Start 7-day free trial';
  return 'Subscribe';
}

function termsLine(plan: Plan, price: PlanPrice) {
  if (plan === 'lifetime') return `${price.price} once. Yours for good.`;
  if (plan === 'yearly') return price.trial ? `Free for 7 days, then ${price.price} a year.` : `${price.price} a year. Renews automatically.`;
  return `${price.price} a month. Renews automatically.`;
}

function Badge({ label, strong }: { label: string; strong?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={[styles.badge, { backgroundColor: strong ? c.a1 : c.a1soft }]}>
      <Text style={[styles.badgeText, { color: strong ? c.a1ink : c.a1text }]}>{label}</Text>
    </View>
  );
}

function PlanCard({ plan, price, selected, onPress }: { plan: Plan; price: PlanPrice; selected: boolean; onPress: () => void }) {
  const { c } = useTheme();
  const title = plan === 'yearly' ? 'Yearly' : plan === 'monthly' ? 'Monthly' : 'Lifetime';
  const main = plan === 'yearly' ? `${price.price} / year` : plan === 'monthly' ? `${price.price} / month` : price.price;
  const sub =
    plan === 'yearly'
      ? price.perMonth
        ? `≈ ${price.perMonth} / month`
        : 'Billed once a year'
      : plan === 'monthly'
        ? 'Billed monthly'
        : 'One-time purchase';
  const badges = plan === 'yearly' ? [...(price.trial ? ['7-day free trial'] : []), 'Best value'] : [];
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.98}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={[title, main.replace(' / ', ' a '), sub.replace('≈', 'about').replace(' / ', ' a '), ...badges].join(', ')}
      style={[styles.plan, { backgroundColor: c.surface, borderColor: selected ? c.a1 : c.line }]}
    >
      <View style={[styles.radio, { borderColor: selected ? c.a1 : c.ink3, backgroundColor: selected ? c.a1 : 'transparent' }]}>
        {selected && <Icon name="check" size={13} strokeWidth={3.2} color={c.a1ink} />}
      </View>
      <View style={styles.planText}>
        {badges.length > 0 && (
          <View style={styles.badges}>
            {badges.map((b, i) => (
              <Badge key={b} label={b} strong={i === 0 && price.trial} />
            ))}
          </View>
        )}
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="small" color="ink3">{sub}</Text>
      </View>
      <Text style={styles.planPrice} tabular>{main}</Text>
    </PressableScale>
  );
}

function LinkText({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={{ top: 12, bottom: 12, left: 6, right: 6 }}
      accessibilityRole="link"
      accessibilityLabel={label}
      style={({ pressed }) => ({ opacity: pressed || disabled ? 0.5 : 1 })}
    >
      <Text style={[styles.link, { color: c.ink2 }]}>{label}</Text>
    </Pressable>
  );
}

function Links({ onRestore, restoring }: { onRestore: () => void; restoring: boolean }) {
  const { c } = useTheme();
  const dot = <Text style={[styles.link, { color: c.ink3 }]} accessible={false}>·</Text>;
  return (
    <View style={styles.links}>
      <LinkText label={restoring ? 'Restoring…' : 'Restore purchases'} onPress={onRestore} disabled={restoring} />
      {dot}
      <LinkText label="Terms" onPress={() => openLink(LEGAL.terms)} />
      {dot}
      <LinkText label="Privacy" onPress={() => openLink(LEGAL.privacy)} />
    </View>
  );
}

function Header() {
  return (
    <View style={styles.top}>
      <IconButton icon="close" label="Close" onPress={goBack} />
    </View>
  );
}

/** Paywall and "You're on Plus" (SPEC Plus). */
export default function PlusScreen() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const { c } = useTheme();
  const { active, status } = usePlus();
  const availability = useBilling((s) => s.availability);
  const prices = useBilling((s) => s.prices);
  const [plan, setPlan] = useState<Plan>('yearly');
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    void initBilling();
    void refreshPlus();
  }, []);

  const onRestore = async () => {
    if (restoring) return;
    setRestoring(true);
    const r = await restore();
    setRestoring(false);
    if (r.kind === 'restored') {
      haptic.success();
      toast(r.status.active ? 'Purchases restored. Welcome back to Plus.' : 'Purchases restored.', 'sparkle');
    } else if (r.kind === 'none') toast('No Plus purchases found on this Google account.', 'sparkle');
    else toast(r.message, 'sparkle');
  };

  if (active) {
    const play = isPlaySubscription(status);
    return (
      <Screen contentStyle={styles.content}>
        <Header />
        <View style={styles.hero}>
          <Mascot size={120} face="happy" accessory="star" />
          <Text variant="h1" align="center" accessibilityRole="header">You’re on Plus</Text>
          <Text color="ink2" align="center">Thanks for helping {APP_NAME} grow.</Text>
        </View>
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
          <View style={styles.statusRow}>
            <View style={[styles.statusTile, { backgroundColor: c.a1soft }]}>
              <Icon name="sparkle" size={20} color={c.a1text} />
            </View>
            <View style={styles.flex}>
              <Text variant="bodyStrong">{`${APP_NAME} Plus · ${planLabel(status)}`}</Text>
              <Text variant="small" color="ink3">{renewalLabel(status).replace(/^./, (x) => x.toUpperCase())}</Text>
            </View>
          </View>
          {play && <Button label="Manage subscription" variant="secondary" size="md" onPress={manageSubscription} />}
        </View>
        <View style={styles.section}>
          <Text variant="caption" color="ink3" accessibilityRole="header">What’s included</Text>
          <BenefitList />
        </View>
        <Links onRestore={onRestore} restoring={restoring} />
      </Screen>
    );
  }

  const billing = { availability, prices };
  const priceOf = (p: Plan): PlanPrice => prices[p] ?? FALLBACK_PRICES[p];
  const price = priceOf(plan);
  const storeReady = canBuy(billing, plan);
  const connecting = availability === 'unknown' || availability === 'connecting';
  // Development: without Play Billing, a fake token exercises the whole server flow.
  const simulate = __DEV__ && !storeReady && !connecting;
  const disabled = !storeReady && !simulate;
  const context = from ? PLUS_CONTEXT[from as PlusFrom] : undefined;

  const onBuy = async () => {
    if (busy || disabled) return;
    setBusy(true);
    setNote(null);
    const r = simulate ? await simulatePurchase(plan) : await buy(plan);
    setBusy(false);
    if (r.kind === 'success') celebratePlus();
    else if (r.kind === 'pending' || r.kind === 'error') setNote(r.message);
  };

  const footer = (
    <View style={styles.footer}>
      <Button label={ctaLabel(plan, price, simulate)} onPress={onBuy} loading={busy || connecting} disabled={disabled && !connecting} />
      <Text variant="small" color="ink3" align="center">
        {disabled && !connecting ? BILLING_COPY.unavailable : connecting ? 'Connecting to Google Play…' : termsLine(plan, price)}
      </Text>
      {note && (
        <Text variant="small" color="a1text" align="center" accessibilityLiveRegion="polite">
          {note}
        </Text>
      )}
    </View>
  );

  return (
    <Screen contentStyle={styles.content} footer={footer}>
      <Header />
      <View style={styles.hero}>
        <Mascot size={120} face="wow" accessory="sparkle" />
        <Text variant="h1" align="center" accessibilityRole="header">{`${APP_NAME} Plus`}</Text>
        <Text color="ink2" align="center">Grow further, gently.</Text>
        {context && (
          <View style={[styles.context, { backgroundColor: c.a1soft }]}>
            <Text variant="small" color="a1text" align="center">{context}</Text>
          </View>
        )}
      </View>
      <BenefitList />
      <View style={styles.plans} accessibilityRole="radiogroup" accessibilityLabel="Plans">
        {PLANS.map((p) => (
          <PlanCard
            key={p}
            plan={p}
            price={priceOf(p)}
            selected={p === plan}
            onPress={() => {
              if (p !== plan) haptic.selection();
              setPlan(p);
              setNote(null);
            }}
          />
        ))}
      </View>
      <Text variant="small" color="ink3" align="center" style={styles.smallPrint}>{SMALL_PRINT}</Text>
      <Links onRestore={onRestore} restoring={restoring} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { maxWidth: 560, gap: 22 },
  top: { flexDirection: 'row', justifyContent: 'flex-end', paddingTop: 8 },
  hero: { alignItems: 'center', gap: 8, marginTop: -12 },
  context: { marginTop: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 14 },
  section: { gap: 12 },
  plans: { gap: 10 },
  plan: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 16, borderRadius: 22, borderWidth: 2 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  planText: { flex: 1, gap: 2 },
  planPrice: { fontFamily: fonts.display700, fontSize: 17, lineHeight: 22 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  badge: { height: 20, paddingHorizontal: 8, borderRadius: 10, justifyContent: 'center' },
  badgeText: { fontFamily: fonts.body700, fontSize: 11, lineHeight: 14 },
  smallPrint: { fontSize: 11.5, lineHeight: 16 },
  links: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  link: { fontFamily: fonts.body600, fontSize: 13 },
  footer: { gap: 8, width: '100%', maxWidth: 560, alignSelf: 'center' },
  card: { borderRadius: 24, borderWidth: 1, padding: 16, gap: 14 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  statusTile: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
});
