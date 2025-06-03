import Dashboard from "./Dashboard";
import RouteBase from "routes/RouteBase";

const Root = (props: any) => <RouteBase {...props} renderRoute={(p) => <Dashboard {...p} />} />;

export default Root;
