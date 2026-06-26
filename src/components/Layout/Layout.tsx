import {
  Divider,
  Dropdown,
  DropdownItem,
  DropdownList,
  Masthead,
  MastheadBrand,
  MastheadContent,
  MastheadLogo,
  MastheadMain,
  MenuToggle,
  Nav,
  NavItem,
  NavList,
  Page,
  PageSection,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
} from "@patternfly/react-core";
import { useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import RedHatLogo from "../../assets/logos/rh_developer_sandbox_logo.svg?react";
import { useSandboxContext } from "../../hooks/SandboxContext";
import { WorkspaceResetModal } from "../Modals";
import "./Layout.css";

export function Layout() {
  const { userData, userReady, refetchUserData } = useSandboxContext();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const displayName =
    userData?.givenName && userData?.familyName
      ? `${userData.givenName} ${userData.familyName}`
      : userData?.givenName || "User";

  const handleResetComplete = async () => {
    setIsResetModalOpen(false);
    await refetchUserData();
  };

  const masthead = (
    <Masthead>
      <MastheadMain>
        <MastheadBrand>
          <MastheadLogo
            component="a"
            href="/"
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              navigate("/");
            }}
          >
            <RedHatLogo
              className="rh-logo"
              style={{ height: "36px", marginRight: "8px" }}
              aria-label="Red Hat Developer Sandbox"
            />
          </MastheadLogo>
        </MastheadBrand>
      </MastheadMain>
      <MastheadContent>
        <Toolbar isFullHeight>
          <ToolbarContent>
            <ToolbarGroup align={{ default: "alignStart" }}>
              <ToolbarItem>
                <Nav variant="horizontal">
                  <NavList>
                    <NavItem isActive={location.pathname === "/"}>
                      <NavLink to="/" end>
                        Catalog
                      </NavLink>
                    </NavItem>
                    <NavItem isActive={location.pathname === "/activities"}>
                      <NavLink to="/activities">Activities</NavLink>
                    </NavItem>
                  </NavList>
                </Nav>
              </ToolbarItem>
            </ToolbarGroup>
            <ToolbarGroup align={{ default: "alignEnd" }}>
              <ToolbarItem>
                <Dropdown
                  isOpen={isDropdownOpen}
                  onSelect={() => setIsDropdownOpen(false)}
                  onOpenChange={setIsDropdownOpen}
                  toggle={{
                    toggleNode: (
                      <MenuToggle
                        ref={toggleRef}
                        onClick={() => setIsDropdownOpen((prev) => !prev)}
                        isExpanded={isDropdownOpen}
                      >
                        {displayName}
                      </MenuToggle>
                    ),
                    toggleRef,
                  }}
                >
                  <DropdownList>
                    {userReady && (
                      <>
                        <DropdownItem
                          key="reset"
                          onClick={() => setIsResetModalOpen(true)}
                          data-testid="reset-workspaces-menu-item"
                        >
                          Reset Workspaces
                        </DropdownItem>
                        <Divider key="divider" />
                      </>
                    )}
                    <DropdownItem key="logout" onClick={() => logout()}>
                      Log out
                    </DropdownItem>
                  </DropdownList>
                </Dropdown>
              </ToolbarItem>
            </ToolbarGroup>
          </ToolbarContent>
        </Toolbar>
      </MastheadContent>
    </Masthead>
  );

  return (
    <Page masthead={masthead}>
      <PageSection
        hasBodyWrapper={false}
        isFilled
        padding={{ default: "noPadding" }}
      >
        <Outlet />
      </PageSection>
      <WorkspaceResetModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onReset={handleResetComplete}
      />
    </Page>
  );
}
