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
import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import RedHatLogo from "../../assets/logos/rh_developer_sandbox_logo.svg?react";
import { useAuth } from "../../auth/useAuth";
import { Environment, getConfig } from "../../config/config";
import { UserSignupPhase, useUserContext } from "../../hooks/UserContext";
import { WorkspaceResetModal } from "../Modals";
import "./Layout.css";

export function Layout() {
  const { logout } = useAuth();
  const { refetchUserData, user, userSignupPhase } = useUserContext();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let isProd: boolean;
    try {
      isProd = getConfig().environment === Environment.PRODUCTION;
    } catch {
      return;
    }
    if (!isProd) return;

    if (!document.getElementById("trustarc")) {
      const script = document.createElement("script");
      script.id = "trustarc";
      script.src =
        "//static.redhat.com/libs/redhat/marketing/latest/trustarc/trustarc.js";
      document.body.appendChild(script);
    }
    if (!document.getElementById("dpal")) {
      const script = document.createElement("script");
      script.id = "dpal";
      script.src = "https://www.redhat.com/ma/dpal.js";
      document.body.appendChild(script);
    }
  }, []);

  const displayName =
    user?.givenName && user?.familyName
      ? `${user.givenName} ${user.familyName}`
      : user?.givenName || "User";

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
                  popperProps={{ position: "end" }}
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
                    {userSignupPhase === UserSignupPhase.READY && (
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
