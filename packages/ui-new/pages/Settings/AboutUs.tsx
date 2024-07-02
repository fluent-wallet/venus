import BIMWalletLogo from '@assets/icons/swift-shield.webp';
import BottomSheet, {
  BottomSheetWrapper,
  BottomSheetHeader,
  BottomSheetFooter,
  BottomSheetContent,
  snapPoints,
  BottomSheetFlatList,
} from '@components/BottomSheet';
import Button from '@components/Button';
import Text from '@components/Text';
import { Lang, useLanguage } from '@hooks/useI18n';
import { useTheme } from '@react-navigation/native';
import { UpdateVersionStackName, type AboutUsStackName, type StackScreenProps } from '@router/configs';
import { APP_VERSION_FLAG_FEATURE, ENABLE_CHECK_UPDATE_FEATURE } from '@utils/features';
import { Image } from 'expo-image';
import type React from 'react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, ScrollView, StyleSheet } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import semverLt from 'semver/functions/lt';
import pkg from '../../../../package.json';
import { SettingItem } from './index';

export interface VersionJSON {
  version: string;
  force: boolean;
  en: {
    description: string;
    messageList: string[];
  };
  'zh-Hant': {
    description: string;
    messageList: string[];
  };
}

const AboutUs: React.FC<StackScreenProps<typeof AboutUsStackName>> = ({ navigation }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const lang = useLanguage();

  const [loading, setLoading] = useState(false);
  const openTeamsService = useCallback(() => {
    Linking.openURL('https://swiftshield.tech/terms.html');
  }, []);

  const openFeedback = useCallback(() => {
    if (lang === Lang.zhHant) {
      Linking.openURL('https://v4deu0ke8sn.typeform.com/to/szRxg7sS');
    } else {
      Linking.openURL('https://v4deu0ke8sn.typeform.com/to/q41dMm2o');
    }
  }, [lang]);

  const handleCheckNewVersion = useCallback(async () => {
    setLoading(true);
    try {
      const remoteVersion = await fetch('https://download.swiftshield.tech/version.json', { method: 'GET' }).then<VersionJSON>((res) => res.json());

      if (semverLt(pkg.version, remoteVersion.version)) {
        // has new version , to show user
        navigation.navigate(UpdateVersionStackName, { newVersion: remoteVersion });
      } else {
        showMessage({
          message: t('settings.aboutUs.latestVersion'),
          type: 'success',
          duration: 1500,
        });
      }
    } catch (error) {
      setLoading(false);
    }
    setLoading(false);
  }, [t]);

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <Image source={BIMWalletLogo} style={styles.logo} />

      <Text style={[styles.swiftshield, { color: colors.textPrimary }]}>{t('settings.aboutUs.title')}</Text>
      <Text style={[styles.version, { color: colors.textSecondary }]}>
        {t('settings.aboutUs.version')}: {pkg.version} {APP_VERSION_FLAG_FEATURE.allow && APP_VERSION_FLAG_FEATURE.value}
      </Text>

      {ENABLE_CHECK_UPDATE_FEATURE.allow && <SettingItem title={t('settings.aboutUs.action.checkUpdate')} onPress={handleCheckNewVersion} disable={loading} />}
      <SettingItem title={t('settings.aboutUs.action.teamsService')} onPress={openTeamsService} />
      <SettingItem title={t('settings.aboutUs.action.feedback')} onPress={openFeedback} />
    </ScrollView>
  );
};

export const UpdateVersion: React.FC<StackScreenProps<typeof UpdateVersionStackName>> = ({ route }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const lang = useLanguage();
  const UILang = lang === Lang.system ? 'en' : lang;

  const { newVersion } = route.params;

  return (
    <BottomSheet snapPoints={snapPoints.percent75} isRoute enablePanDownToClose={!newVersion.force} enableContentPanningGesture={!newVersion.force}>
      <BottomSheetWrapper innerPaddingHorizontal>
        <BottomSheetHeader title={t('settings.aboutUs.UpdateToNew')}>
          {newVersion[UILang]?.description && (
            <Text style={[styles.versionDescription, { color: colors.textSecondary }]}>{newVersion[UILang].description}</Text>
          )}
        </BottomSheetHeader>
        <BottomSheetContent>
          {newVersion[UILang]?.messageList && (
            <BottomSheetFlatList
              data={newVersion[UILang].messageList}
              renderItem={(item) => <Text style={{ color: colors.textPrimary }}> - {item.item}</Text>}
            />
          )}
        </BottomSheetContent>
        <BottomSheetFooter>
          <Button size="small" onPress={() => Linking.openURL('https://swiftshield.tech')}>
            {t('common.update')}
          </Button>
        </BottomSheetFooter>
      </BottomSheetWrapper>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 24,
    display: 'flex',
    flexDirection: 'column',
  },
  logo: {
    width: 72,
    aspectRatio: 1,
    margin: 44,
    alignSelf: 'center',
  },
  swiftshield: {
    marginBottom: 8,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 28,
  },
  version: {
    marginBottom: 32,
    fontWeight: '300',
    fontSize: 14,
    lineHeight: 18,
    textAlign: 'center',
  },
  bottomSheet: {
    paddingHorizontal: 16,
  },
  versionTitle: {
    fontWeight: '600',
    fontSize: 16,
    lineHeight: 18,
    textAlign: 'center',
    marginVertical: 10,
  },
  versionDescription: {
    fontSize: 14,
    fontWeight: '300',
    marginVertical: 16,
  },
  button: {
    marginBottom: 79,
  },
});

export default AboutUs;
