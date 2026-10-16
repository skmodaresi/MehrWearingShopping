import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SvgUri } from 'react-native-svg';
import { assetUrl } from '@/lib/api';

/**
 * The catalog ships vector artwork (SVG) so one asset serves every density.
 * React Native cannot decode SVG through `Image`, so we render it with
 * react-native-svg's URI loader, which also works in react-native-web.
 */
export function ProductImage({
  uri,
  style,
}: {
  uri?: string | null;
  style?: StyleProp<ViewStyle>;
}) {
  if (!uri) return <View style={[styles.placeholder, style]} />;
  return (
    <SvgUri
      uri={assetUrl(uri)}
      width="100%"
      height="100%"
      style={style}
      preserveAspectRatio="xMidYMid slice"
    />
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: '#e2e8f0',
    borderRadius: 12,
    width: '100%',
    aspectRatio: 1,
  },
});
