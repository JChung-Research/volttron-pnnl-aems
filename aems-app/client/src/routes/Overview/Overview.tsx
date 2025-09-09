import "./style.scss";

import Custom from "../../components/Custom";
import { Header } from "components";
import React from "react";
import { RootProps } from "routes";
import { RoleType } from "common";

import "./style.scss";

import { Button, Card, Intent, Position, Menu, MenuItem } from "@blueprintjs/core";
import { Popover2, Tooltip2 } from "@blueprintjs/popover2";
import { IconName, IconNames } from "@blueprintjs/icons";
import { Column, Table2, Cell } from "@blueprintjs/table";
import { selectReadConfigurations } from "controllers/configurations/action";
import {
  IUnit,
  readUnits,
  readUnitsPoll,
  selectFilterUnits,
  selectReadUnits,
} from "controllers/units/action";
import { connect } from "react-redux";
import { Link } from "react-router-dom";

// Overview component props and state types
interface UnitsProps extends RootProps {
  readUnits: () => void;
  readUnitsPoll: (payload?: number) => void;
  filtered?: IUnit[];
}

interface UnitsState {
  selectedLayout: string | null; // UI layout mode (Grid/List)
  sortColumnIndex: number;
  sortAsc: boolean;
  columns: { name: string; key: string }[]; 
  sortedFiltered: IUnit[];  // Filtered + sorted unit list
  selectedSortColumn: string; 
  selectedFilterColumn: string;
  selectedFilterValues: string[];
  columnWidths: number[]; 
  visibleColumns: string[];
  sortingColumns: string[];
}

class Overview extends React.Component<UnitsProps, UnitsState, any> {
  // Set up default layout, sorting, filtering, and visible columns
  constructor(props: UnitsProps) {
    super(props);
    const columns = [
      { name: "Label", key: "label" },
      { name: "Campus", key: "campus" },
      { name: "Building", key: "building" },
      { name: "Building Type", key: "bldgType" },
      { name: "System", key: "system" },
      { name: "Operator", key: "operator" },
      { name: "Timezone", key: "timezone" }
    ];

    this.state = {
      selectedLayout: "Grid tile",
      sortColumnIndex: -1, // -1 means no sorting initially
      sortAsc: true,       // Default is ascending sort
      columns: columns,
      sortedFiltered: [],
      selectedSortColumn: "building",
      selectedFilterColumn: "building", 
      selectedFilterValues: [],
      columnWidths: Array(columns.length).fill(1170 / columns.length),
      visibleColumns: columns.map((column) => column.key),
      sortingColumns: columns.map((column) => column.key)
    }
  }

  componentDidMount() {
    this.props.readUnits();
    this.props.readUnitsPoll();
    this.setState({ sortedFiltered: this.props.filtered || [] });
  }
  layoutOptions = [
    "Grid tile",
    "List"
  ]

  // Column header click = sort toggle
  handleSort = (columnIndex: number) => {
    const { sortColumnIndex, sortAsc } = this.state;
    if (sortColumnIndex === columnIndex) {
      this.setState({ sortAsc: !sortAsc }); // toggle ascending or descending
    } else {
      this.setState({ sortColumnIndex: columnIndex, sortAsc: true });
    }
  };

  // Drag-drop column reordering
  handleColumnsReordered = (oldIndex: number, newIndex: number, length: number) => {
    const columnsCopy = [...this.state.columns];
    const moved = columnsCopy.splice(oldIndex, length);
    columnsCopy.splice(newIndex, 0, ...moved);
    this.setState({ columns: columnsCopy });
  };
  
  // Drag-drop row reordering
  handleRowsReordered = (oldIndex: number, newIndex: number, length: number) => {
    const rowsCopy = [...this.state.sortedFiltered];
    const moved = rowsCopy.splice(oldIndex, length);
    rowsCopy.splice(newIndex, 0, ...moved);
    this.setState({ sortedFiltered: rowsCopy });
  };

  sortBySelectedColumn = (ascending: boolean) => {
    const { selectedSortColumn } = this.state;
    const sorted = [...(this.props.filtered || [])].sort((a, b) => {
      if ((a as any)[selectedSortColumn] < (b as any)[selectedSortColumn]) return ascending ? -1 : 1;
      if ((a as any)[selectedSortColumn] > (b as any)[selectedSortColumn]) return ascending ? 1 : -1;
      return 0;
    });
    this.setState({ sortedFiltered: sorted, sortAsc: ascending });
  };

  // Toggle ascending/descending
  toggleSort = () => {
    const { selectedSortColumn, sortAsc } = this.state;
    const ascending = !sortAsc;
    const sorted = [...(this.props.filtered || [])].sort((a, b) => {
      if ((a as any)[selectedSortColumn] < (b as any)[selectedSortColumn]) return ascending ? -1 : 1;
      if ((a as any)[selectedSortColumn] > (b as any)[selectedSortColumn]) return ascending ? 1 : -1;
      return 0;
    });
    this.setState({ sortedFiltered: sorted, sortAsc: ascending });
  };

  // Unique filter values per column
  getUniqueValues = (columnKey: string): string[] => {
    const unique = new Set<string>();
    (this.props.filtered || []).forEach((item) => {
      const value = (item as any)[columnKey];
      if (value) unique.add(value);
    });
    return Array.from(unique).sort();
  };

  // Multi-checkbox filter toggling
  handleFilterValueToggle = (value: string) => {
    const { selectedFilterValues, selectedFilterColumn } = this.state;
    let updatedValues: string[] = [];
  
    if (selectedFilterValues.includes(value)) {
      updatedValues = selectedFilterValues.filter(v => v !== value);
    } else {
      updatedValues = [...selectedFilterValues, value];
    }
  
    // Apply the filtering function
    const filteredData = (this.props.filtered || []).filter(item => 
      updatedValues.includes((item as any)[selectedFilterColumn])
    );
  
    this.setState({
      selectedFilterValues: updatedValues,
      sortedFiltered: filteredData.length > 0 ? filteredData : (this.props.filtered || [])
    });
  };

  // Dynamically resize columns
  handleColumnWidthChanged = (index: number, size: number) => {
    const columnWidths = [...this.state.columnWidths];
  
    const delta = size - columnWidths[index];
    columnWidths[index] = size;
  
    if (index + 1 < columnWidths.length) {
      columnWidths[index + 1] = Math.max(50, columnWidths[index + 1] - delta); 
    }
  
    this.setState({ columnWidths });
  };

  // Show/hide columns
  handleToggleColumnVisibility = (key: string) => {
    const { visibleColumns } = this.state;
    if (visibleColumns.includes(key)) {
      this.setState({ visibleColumns: visibleColumns.filter(col => col !== key) });
    } else {
      this.setState({ visibleColumns: [...visibleColumns, key] });
    }
  };

  isAdmin() {
    const { user } = this.props;
    return RoleType.Admin.granted(...(user?.role.split(" ") ?? [""]));
  }

  userAccessibleBldgs() {
    const { user } = this.props;
    const access = (user?.bldgAccess ?? {}) as Record<string, boolean>;

    return Object.keys(access).filter((k) => access[k]);
  }
  
  render() {
    const { filtered } = this.props;
    let filteredData = this.props.filtered || [];

    if (this.state.selectedFilterValues.length > 0) {
      filteredData = filteredData.filter(item => 
        this.state.selectedFilterValues.includes((item as any)[this.state.selectedFilterColumn])
      );
    }
    
  let sortedFiltered = this.state.sortedFiltered.length > 0 ? this.state.sortedFiltered : (filtered || []);

  if (this.state.sortColumnIndex !== -1) {
    const columns = this.state.sortingColumns
    const key = columns[this.state.sortColumnIndex] as keyof IUnit;
    sortedFiltered = [...sortedFiltered].sort((a, b) => {
      if (a[key]! < b[key]!) return this.state.sortAsc ? -1 : 1;
      if (a[key]! > b[key]!) return this.state.sortAsc ? 1 : -1;
      return 0;
    });
  }

  if (!this.isAdmin()) {
    sortedFiltered = sortedFiltered.filter(u => this.userAccessibleBldgs().includes(u.building));
  }

  // Adjust column widths based on visibility and total layout width
  const TOTAL_TABLE_WIDTH = 1170;
  const visibleColumns = this.state.columns.filter(col => this.state.visibleColumns.includes(col.key));

  // Get the original widths of visible columns
  const originalVisibleWidths = this.state.columns
    .map((col, index) => {
      if (this.state.visibleColumns.includes(col.key)) {
        return this.state.columnWidths[index];
      }
      return null;
    })
    .filter((width) => width !== null) as number[];
  
  const totalOriginalWidth = originalVisibleWidths.reduce((sum, width) => sum + width, 0);
  const buttonColumnWidth = 100; 
  const visibleDataTableWidth = TOTAL_TABLE_WIDTH - buttonColumnWidth;  
  const visibleColumnWidths = originalVisibleWidths.map(width => (width / totalOriginalWidth) * visibleDataTableWidth);
  
  visibleColumnWidths.push(buttonColumnWidth);

  const rowHeightValue = 60;
  const rowHeights = Array(sortedFiltered.length).fill(rowHeightValue);  

  // Construct Table2 <Column> objects dynamically
  const tableColumns = [
    ...visibleColumns.map((col) => (
      <Column
        key={col.key}
        name={col.name}
        cellRenderer={(rowIndex) => (
          <Cell style={{ display: "flex", alignItems: "center", height: "100%" }}>{(sortedFiltered?.[rowIndex] as Record<string, any>)?.[col.key] || ""}</Cell>
        )}
      />
    )),
    <Column
      key="view"
      name="Link"
      cellRenderer={(rowIndex) => {
        const unitId = sortedFiltered?.[rowIndex]?.id;
        return (
          <Cell style={{ display: "flex", alignItems: "center", height: "100%" }}>
            {unitId && (
              <Tooltip2 content="View" placement={Position.TOP}>
                <Link
                  to={{ pathname: "/dashboard" }}
                  state={{ selectedUnitId: unitId }}
                  style={{ textDecoration: "none" }}
                >
                  <Button
                    icon={IconNames.LINK}
                    intent={Intent.PRIMARY}
                    minimal
                    small
                  />
                </Link>
              </Tooltip2>
            )}
          </Cell>
        );
      }}
    />
  ];  

    return (
      <div className={"overview"}>
        <Header {...this.props} />
        <Custom url="/main.html" />

        <h1 style={{marginBottom:"0.2rem"}}>Building Units</h1>
        <div className="row" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
          <div style={{ display: "flex", alignItems: "center", width: "320px", gap: "4px" }}>
            <h4 style={{ margin: 0, minWidth: "70px" }}>Layout</h4>

            {/* Layout toggle (Grid or List) */}
            <Popover2
              content={
                  <Menu>
                    {this.layoutOptions?.map((value) => (
                      <MenuItem
                        key={value}
                        text={value}
                        onClick={async () => {this.setState({ selectedLayout: value })}}
                      />
                    ))}
                  </Menu>
              }
              placement="bottom-start"
              >
              <Button rightIcon={IconNames.CARET_DOWN} minimal>
                {this.state.selectedLayout ? this.state.selectedLayout : "Select.."}
              </Button>
            </Popover2>
          </div>
        </div>
        
        {/* Grid Tile View */}
        {this.state.selectedLayout === "Grid tile" ? (
          <div className="list container" style={{marginTop:"15px"}}>
            {filtered?.filter((unit) => this.isAdmin() || this.userAccessibleBldgs().includes(unit.building))
            .map((unit, i) => (
              <div className="col-md-4 mb-4" key={unit.id ?? i}>
                <Card className="card shadow-sm" interactive style={{ marginBottom: "2rem", padding: "0px"}}>
                  <div className="placeholder-container">
                    <img src={unit.image} alt={`Thumbnail for ${unit.label}`}/>
                    <div className="placeholder-overlay">
                      <div className="thumnail-text">Thumnail Placeholder<br/>{unit.building} {unit.system}</div>
                    </div>
                  </div>
                  <div className="card-body" style={{padding: "1.25rem"}}>
                    <h4 className="card-title">{unit.label}</h4>
                    <p className="card-text">
                    {unit.description?.split(" ").slice(0, 23).join(" ")}{unit.description?.split(" ").length > 30 ? "..." : ""}
                    </p>
                    <div className="d-flex" style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
                      <div className="btn-group">
                        <Link to={{pathname: "/dashboard",}} state={{ selectedUnitId: unit.id }} className="btn btn-sm btn-outline-secondary" style={{color: "#6c757d", backgroundColor:"transparent", backgroundImage: "none", borderColor: "#6c757d"}}>
                          View
                        </Link>
                      </div>
                      <small className="text-muted">{unit.campus}</small>
                    </div>
                  </div>
                </Card>
              </div>
            ))}
          </div>
        ) : (          
          <div className="row">
            {/* List View with Filtering, Sorting, and Column Selections */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", marginBottom: "15px" }}>
              
              {/* Column Visibility Section */}
              <div style={{ display: "flex", alignItems: "center", width: "320px", gap: "4px" }}>
                <h4 style={{ margin: 0, minWidth: "70px" }}>Columns</h4>

                <Popover2
                  content={
                    <Menu>
                      {this.state.columns.map((col) => (
                        <MenuItem
                          key={col.key}
                          shouldDismissPopover={false}
                          text={
                            <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <input
                                type="checkbox"
                                checked={this.state.visibleColumns.includes(col.key)}
                                onChange={() => this.handleToggleColumnVisibility(col.key)}
                              />
                              {col.name}
                            </label>
                          }
                        />
                      ))}
                    </Menu>
                  }
                  placement="bottom-start"
                >
                  <Button rightIcon={IconNames.CARET_DOWN} minimal>
                    {"Select.."}
                  </Button>
                </Popover2>
              </div>
              
              {/* Sort Section */}
              <div style={{ display: "flex", alignItems: "center", width: "320px", gap: "4px" }}>
                <h4 style={{ margin: 0, minWidth: "70px" }}>Sort</h4>
                <Popover2
                  content={
                    <Menu>
                      {this.state.columns.map((col, index) => (
                        <MenuItem
                          key={col.key}
                          text={col.name}
                          onClick={() => this.setState({ selectedSortColumn: col.key, sortAsc: true })}
                        />
                      ))}
                    </Menu>
                  }
                  placement="bottom-start"
                >
                  <Button rightIcon={IconNames.CARET_DOWN} minimal style={{ paddingTop: "8px" }}>
                    {this.state.columns.find(c => c.key === this.state.selectedSortColumn)?.name || "Select Column"}
                  </Button>
                </Popover2>

                <Button
                  icon={this.state.sortAsc ? IconNames.SORT_ASC : IconNames.SORT_DESC}
                  text={this.state.sortAsc ? "Asc" : "Desc"}
                  onClick={this.toggleSort}
                  small
                />
              </div>

              {/* Filter Section */}
              <div style={{ display: "flex", alignItems: "center", width: "320px", gap: "4px" }}>
                <h4 style={{ margin: 0, minWidth: "70px" }}>Filter</h4>

                {/* Filter Column Dropdown */}
                <Popover2
                  content={
                    <Menu>
                      {this.state.columns.map((col, index) => (
                        <MenuItem
                          key={col.key}
                          text={col.name}
                          onClick={() => this.setState({ selectedFilterColumn: col.key, selectedFilterValues: [] })}
                        />
                      ))}
                    </Menu>
                  }
                  placement="bottom-start"
                >
                  <Button rightIcon={IconNames.CARET_DOWN} minimal>
                    {this.state.columns.find(c => c.key === this.state.selectedFilterColumn)?.name || "Select Column"}
                  </Button>
                </Popover2>

                {/* Filter Value Dropdown */}
                <Popover2
                  content={
                    <Menu>
                      {this.getUniqueValues(this.state.selectedFilterColumn).map((value) => (
                        <MenuItem
                          key={value}
                          shouldDismissPopover={false}
                          text={
                            <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <input
                                type="checkbox"
                                checked={this.state.selectedFilterValues.includes(value)}
                                onChange={() => this.handleFilterValueToggle(value)}
                              />
                              {value}
                            </label>
                          }
                        />
                      ))}
                    </Menu>
                  }
                  placement="bottom-start"
                >
                  <Button rightIcon={IconNames.CARET_DOWN} minimal>
                    {"Select.."}
                  </Button>
                </Popover2>
              </div>
            </div>

            <Table2 
              numRows={sortedFiltered.length} 
              rowHeights={rowHeights} 
              enableRowHeader={true} 
              enableColumnResizing={true}
              enableColumnReordering={true}
              enableRowReordering={true}
              onColumnsReordered={this.handleColumnsReordered}
              onRowsReordered={this.handleRowsReordered}  
              columnWidths={visibleColumnWidths}
              onColumnWidthChanged={this.handleColumnWidthChanged}
              >
                {tableColumns}  
            </Table2>
          </div>
          )}
      </div>    
    );
  }
}

const mapStateToProps = (state: any) => ({
  units: selectReadUnits(state),
  filtered: selectFilterUnits(state),
  configurations: selectReadConfigurations(state),
});

const mapActionToProps = {
  readUnits,
  readUnitsPoll,
};

export default connect(mapStateToProps, mapActionToProps)(Overview);