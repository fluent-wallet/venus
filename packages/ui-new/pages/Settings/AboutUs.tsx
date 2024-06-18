import React, { useCallback, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import Text from '@components/Text';
import { AboutUsStackName, type StackScreenProps } from '@router/configs';
import { APP_VERSION_FLAG_FEATURE, ENABLE_CHECK_UPDATE_FEATURE } from '@utils/features';
import { Lang, useLanguage } from '@hooks/useI18n';
import SwiftShieldLogo from '@assets/icons/swift-shield.webp';
import { SettingItem } from './index';
import pkg from '../../../../package.json';
import { Image } from 'expo-image';
import semverLt from 'semver/functions/lt';
import { showMessage } from 'react-native-flash-message';
import BottomSheet, { BottomSheetView, snapPoints, BottomSheetFlatList } from '@components/BottomSheet';
import Button from '@components/Button';

type VersionJSON = {
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
};

const AboutUs: React.FC<StackScreenProps<typeof AboutUsStackName>> = ({ navigation }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const lang = useLanguage();

  const [loading, setLoading] = useState(false);
  const [newVersion, setNewVersion] = useState<null | VersionJSON>(null);
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
        setNewVersion(remoteVersion);
      } else {
        setNewVersion(null),
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

  const handleOpenWebsite = useCallback(() => {
    Linking.openURL('https://swiftshield.tech');
  }, []);

  const UILang = lang === Lang.system ? 'en' : lang;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        <Image source={SwiftShieldLogo} style={styles.logo} />

        <Text style={[styles.swiftshield, { color: colors.textPrimary }]}>{t('settings.aboutUs.title')}</Text>
        <Text style={[styles.version, { color: colors.textSecondary }]}>
          {t('settings.aboutUs.version')}: {pkg.version} {APP_VERSION_FLAG_FEATURE.allow && APP_VERSION_FLAG_FEATURE.value}
        </Text>

        {ENABLE_CHECK_UPDATE_FEATURE.allow && (
          <SettingItem title={t('settings.aboutUs.action.checkUpdate')} onPress={handleCheckNewVersion} disable={loading} />
        )}
        <SettingItem title={t('settings.aboutUs.action.teamsService')} onPress={openTeamsService} />
        <SettingItem title={t('settings.aboutUs.action.feedback')} onPress={openFeedback} />
      </ScrollView>
      {newVersion && (
        <BottomSheet
          style={styles.bottomSheet}
          snapPoints={snapPoints.percent75}
          index={0}
          onClose={() => setNewVersion(null)}
          showBackDrop={false}
          enablePanDownToClose
        >
          <Text style={[styles.versionTitle, { color: colors.textPrimary }]}>{t('settings.aboutUs.UpdateToNew')}</Text>
          {newVersion[UILang]?.description && (
            <Text style={[styles.versionDescription, { color: colors.textSecondary }]}>{newVersion[UILang].description}</Text>
          )}
          {newVersion[UILang]?.messageList && (
            <BottomSheetFlatList
              data={newVersion[UILang].messageList}
              renderItem={(item) => <Text style={{ color: colors.textPrimary }}> - {item.item}</Text>}
            />
          )}

          <Button onPress={handleOpenWebsite} style={styles.button}>
            {t('common.update')}
          </Button>
        </BottomSheet>
      )}
    </View>
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
