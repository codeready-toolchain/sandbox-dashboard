import "./Layout.css";

import {
  AlertVariant,
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
import { useAuth } from "../../auth/useAuth";
import { useNotifications } from "../../hooks/NotificationContext";
import { useUserContext } from "../../hooks/UserContext";
import { UserSignupPhase } from "../../hooks/userSignupPhase";
import logger from "../../utils/logger";
import { WorkspaceResetModal } from "../Modals";
import { PageFooter } from "./PageFooter";

export function Layout() {
  const { logout } = useAuth();
  const { refetchUserData, user, userSignupPhase } = useUserContext();
  const { addAlert } = useNotifications();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const displayName =
    user?.givenName && user?.familyName
      ? `${user.givenName} ${user.familyName}`
      : user?.givenName || "User";

  const handleResetComplete = async () => {
    setIsResetModalOpen(false);

    // Refetch the user data and log any errors. We do not
    refetchUserData().catch((error) => {
      logger.warn(
        "Refetching the user's signup after resetting the user's workspaces threw an error",
        error,
      );

      addAlert(
        AlertVariant.warning,
        "Unable to refresh your user's details",
        "The resetting of your workspace was scheduled, but we were unable to refresh your user's details at the moment. You might have to refresh the page in order to see the reset to be completed. Sorry for the inconvenience.",
      );
    });
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
                        aria-label="User menu"
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
      <PageSection hasBodyWrapper={false} padding={{ default: "noPadding" }}>
        <Outlet />
        <PageFooter />
      </PageSection>
      <WorkspaceResetModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onReset={handleResetComplete}
      />
    </Page>
  );
}
