import { useState } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  AppShell,
  Burger,
  Group,
  NavLink,
  Title,
  Button,
  Text,
  Menu,
  Avatar,
  UnstyledButton,
  Stack,
} from '@mantine/core';
import {
  IconHome,
  IconFileText,
  IconClipboardList,
  IconLogout,
  IconChevronDown,
  IconUser,
} from '@tabler/icons-react';
import { useAuth, authActions } from '../../services/auth/authSlice';
import { useLogoutMutation } from '../../services/auth/authApi';
import { useAppDispatch } from '../../app/hooks';

const navItems = [
  { icon: IconHome, label: 'Dashboard', path: '/dashboard' },
  { icon: IconFileText, label: 'Aufgaben', path: '/questions' },
  { icon: IconClipboardList, label: 'Prüfungen', path: '/exams' },
];

export const DashboardLayout = () => {
  const [opened, setOpened] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const user = useAuth();
  const [logout] = useLogoutMutation();

  const handleLogout = async () => {
    await logout();
    dispatch(authActions.logout());
    navigate('/login');
  };

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 250, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger
              opened={opened}
              onClick={() => setOpened(!opened)}
              hiddenFrom="sm"
              size="sm"
            />
            <Title order={3} c="blue">
              DigitalExam
            </Title>
          </Group>

          <Menu shadow="md" width={200}>
            <Menu.Target>
              <UnstyledButton>
                <Group gap="xs">
                  <Avatar color="blue" radius="xl" size="sm">
                    {user?.name?.charAt(0).toUpperCase()}
                  </Avatar>
                  <Text size="sm" visibleFrom="sm">
                    {user?.name}
                  </Text>
                  <IconChevronDown size={14} />
                </Group>
              </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>Konto</Menu.Label>
              <Menu.Item leftSection={<IconUser size={14} />}>
                Profil
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item
                color="red"
                leftSection={<IconLogout size={14} />}
                onClick={handleLogout}
              >
                Abmelden
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <Stack gap="xs">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              component={Link}
              to={item.path}
              label={item.label}
              leftSection={<item.icon size={20} />}
              active={location.pathname === item.path || location.pathname.startsWith(item.path + '/')}
              onClick={() => setOpened(false)}
            />
          ))}
        </Stack>
        {/* Add version information here */}
        <Text size="xs" c="dimmed" style={{ marginTop: 'auto', paddingBottom: '10px' }}>
          Version: {import.meta.env.VITE_APP_VERSION}
        </Text>
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
};
