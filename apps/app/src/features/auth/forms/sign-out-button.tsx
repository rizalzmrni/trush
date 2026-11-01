import { IconLogout } from "@tabler/icons-react";
import { Button } from "@trush/design-system/components/ui/button";
import { Form, useNavigation } from "react-router";

import { SIGN_OUT_PATH } from "../safe-redirect";

/** Tombol keluar: POST ke action `/sign-out` (bukan tautan GET). */
export const SignOutButton = () => {
  const navigation = useNavigation();
  const submitting =
    navigation.state !== "idle" && navigation.formAction === SIGN_OUT_PATH;
  return (
    <Form action={SIGN_OUT_PATH} method="post">
      <Button
        aria-busy={submitting}
        disabled={submitting}
        type="submit"
        variant="outline"
      >
        <IconLogout aria-hidden="true" data-icon="inline-start" />
        Keluar
      </Button>
    </Form>
  );
};
