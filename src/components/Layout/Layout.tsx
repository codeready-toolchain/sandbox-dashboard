import { useRef, useState } from "react";
import { NavLink, Outlet } from "react-router";
import {
  Dropdown,
  DropdownItem,
  DropdownList,
  Masthead,
  MastheadBrand,
  MastheadContent,
  MastheadMain,
  MastheadLogo,
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
import { useAuth } from "../../auth/useAuth";
import RedHatLogo from "../../assets/logos/logo_hat-only.svg";

export function Layout() {
  const { givenName, familyName, logout } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const displayName =
    givenName && familyName
      ? `${givenName} ${familyName}`
      : givenName || "User";

  const masthead = (
    <Masthead>
      <MastheadMain>
        <MastheadBrand>
          <MastheadLogo
            component="a"
            href="/"
            onClick={(e: React.MouseEvent) => e.preventDefault()}
          >
            <img
              src={RedHatLogo}
              alt="Red Hat"
              style={{ height: "36px", marginRight: "8px" }}
            />
            Developer Sandbox
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
                    <NavItem>
                      <NavLink
                        to="/"
                        end
                        className={({ isActive }) =>
                          isActive ? "pf-m-current" : ""
                        }
                      >
                        Catalog
                      </NavLink>
                    </NavItem>
                    <NavItem>
                      <NavLink
                        to="/activities"
                        className={({ isActive }) =>
                          isActive ? "pf-m-current" : ""
                        }
                      >
                        Activities
                      </NavLink>
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
      <PageSection hasBodyWrapper={false} isFilled>
        <Outlet />
      </PageSection>
    </Page>
  );
}
