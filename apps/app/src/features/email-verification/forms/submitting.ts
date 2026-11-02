import { useNavigation } from "react-router";

import { INTENT_FIELD } from "../form-schema";
import type { VerifyEmailIntent } from "../form-schema";

/** Form verifikasi email dengan `intent` ini sedang dikirim (dua form per halaman). */
export const useIntentSubmitting = (intent: VerifyEmailIntent): boolean => {
  const navigation = useNavigation();
  return (
    navigation.state !== "idle" &&
    navigation.formMethod === "POST" &&
    navigation.formData?.get(INTENT_FIELD) === intent
  );
};
