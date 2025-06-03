import { RouteType } from "routes/types";
import { lazy } from "react";

const Element = lazy(() => import("./index"));

const route: RouteType = {
  id: 1500,
  parentId: 0,
  name: "Overview",
  label: "Overview",
  path: "Overview",
  element: Element,
  footer: true,
  user: false,
  admin: false,
  hidden: false,
};

export default route;
