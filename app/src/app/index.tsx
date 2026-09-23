import { Redirect } from 'expo-router';

// Temporary: step 1 lands on the design-system review screen. Step 2 replaces this
// with the tab shell, and step 8 with splash → onboarding.
export default function Index() {
  return <Redirect href="/dev/design-system" />;
}
