import Overview from "./Overview";
import RouteBase from "routes/RouteBase";

const Root = (props: any) => <RouteBase {...props} renderRoute={(p) => <Overview {...p} />} />;

export default Root;
