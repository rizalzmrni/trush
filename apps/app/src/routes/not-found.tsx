import { NotFoundPage } from "@trush/design-system/components/feedback/error-page";
import { buttonVariants } from "@trush/design-system/components/ui/button";
import { data, Link } from "react-router";

const NOT_FOUND = 404;

// Loader memberi status HTTP 404 pada dokumen; tanpa ini splat route = 200.
export const loader = () => data(null, { status: NOT_FOUND });

const NotFoundRoute = () => (
  <NotFoundPage
    action={
      <Link className={buttonVariants({ size: "lg" })} to="/">
        Kembali ke beranda
      </Link>
    }
  />
);
export default NotFoundRoute;
