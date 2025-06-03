import { RouteType } from "routes/types";
import { lazy } from "react";

const Element = lazy(() => import("./index"));

const route: RouteType = {
  id: 2000,
  parentId: 0,
  name: "Dashboard",
  label: "Dashboard",
  path: "Dashboard",
  element: Element,
  footer: true,
  user: false,
  admin: false,
  hidden: false,
};

export default route;
