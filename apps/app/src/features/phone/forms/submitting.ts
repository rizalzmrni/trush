import { useNavigation } from "react-router";

import { INTENT_FIELD } from "../form-schema";
import type { PhoneIntent } from "../form-schema";

/** Form telepon dengan `intent` ini sedang dikirim (beberapa form per halaman). */
export const usePhoneSubmitting = (intent: PhoneIntent): boolean => {
  const navigation = useNavigation();
  return (
    navigation.state !== "idle" &&
    navigation.formMethod === "POST" &&
    navigation.formData?.get(INTENT_FIELD) === intent
  );
};
