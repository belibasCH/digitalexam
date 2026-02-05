import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Container,
  Title,
  Text,
  Paper,
  Button,
  Group,
  Stack,
  TextInput,
  Textarea,
  ActionIcon,
  Skeleton,
  Alert,
  Modal,
  Badge,
  Card,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconPlus,
  IconUsers,
  IconAlertCircle,
  IconCheck,
  IconX,
  IconSettings,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import {
  useGetMyGroupsQuery,
  useCreateGroupMutation,
} from '../../services/groups/groupsApi';
import {
  useGetMyInvitationsQuery,
  useAcceptInvitationMutation,
  useDeclineInvitationMutation,
} from '../../services/groups/invitationsApi';
import { GroupRole } from '../../types/database';

const getRoleBadge = (role: GroupRole) => {
  switch (role) {
    case 'owner':
      return <Badge color="blue" size="sm">Besitzer</Badge>;
    case 'admin':
      return <Badge color="grape" size="sm">Admin</Badge>;
    default:
      return <Badge color="gray" size="sm">Mitglied</Badge>;
  }
};

export const GroupsListPage = () => {
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');

  const { data: groups, isLoading, error } = useGetMyGroupsQuery();
  const { data: invitations } = useGetMyInvitationsQuery();
  const [createGroup, { isLoading: creating }] = useCreateGroupMutation();
  const [acceptInvitation, { isLoading: accepting }] = useAcceptInvitationMutation();
  const [declineInvitation, { isLoading: declining }] = useDeclineInvitationMutation();

  const handleOpenCreate = () => {
    setGroupName('');
    setGroupDescription('');
    openModal();
  };

  const handleCreate = async () => {
    if (!groupName.trim()) {
      notifications.show({
        title: 'Fehler',
        message: 'Bitte geben Sie einen Namen ein.',
        color: 'red',
      });
      return;
    }

    try {
      await createGroup({
        name: groupName.trim(),
        description: groupDescription.trim() || undefined,
      }).unwrap();
      notifications.show({
        title: 'Gruppe erstellt',
        message: 'Die neue Gruppe wurde erstellt.',
        color: 'green',
      });
      closeModal();
    } catch {
      notifications.show({
        title: 'Fehler',
        message: 'Die Gruppe konnte nicht erstellt werden.',
        color: 'red',
      });
    }
  };

  const handleAcceptInvitation = async (invitationId: string) => {
    try {
      await acceptInvitation(invitationId).unwrap();
      notifications.show({
        title: 'Einladung angenommen',
        message: 'Sie sind der Gruppe beigetreten.',
        color: 'green',
      });
    } catch {
      notifications.show({
        title: 'Fehler',
        message: 'Die Einladung konnte nicht angenommen werden.',
        color: 'red',
      });
    }
  };

  const handleDeclineInvitation = async (invitationId: string) => {
    try {
      await declineInvitation(invitationId).unwrap();
      notifications.show({
        title: 'Einladung abgelehnt',
        message: 'Die Einladung wurde abgelehnt.',
        color: 'gray',
      });
    } catch {
      notifications.show({
        title: 'Fehler',
        message: 'Die Einladung konnte nicht abgelehnt werden.',
        color: 'red',
      });
    }
  };

  return (
    <Container size="lg">
      <Stack gap="lg">
        <Group justify="space-between">
          <div>
            <Title order={2}>Gruppen</Title>
            <Text c="dimmed" mt="xs">
              Arbeiten Sie mit anderen Lehrern zusammen und teilen Sie Aufgaben
            </Text>
          </div>
          <Button leftSection={<IconPlus size={16} />} onClick={handleOpenCreate}>
            Neue Gruppe
          </Button>
        </Group>

        {/* Pending Invitations Banner */}
        {invitations && invitations.length > 0 && (
          <Paper p="md" radius="md" withBorder bg="blue.0">
            <Stack gap="sm">
              <Text fw={500}>
                Sie haben {invitations.length} offene Einladung{invitations.length !== 1 ? 'en' : ''}
              </Text>
              {invitations.map((inv) => (
                <Paper key={inv.id} p="sm" radius="sm" withBorder>
                  <Group justify="space-between">
                    <div>
                      <Text fw={500}>{inv.group.name}</Text>
                      {inv.group.description && (
                        <Text size="sm" c="dimmed" lineClamp={1}>
                          {inv.group.description}
                        </Text>
                      )}
                    </div>
                    <Group gap="xs">
                      <Button
                        size="xs"
                        color="green"
                        leftSection={<IconCheck size={14} />}
                        onClick={() => handleAcceptInvitation(inv.id)}
                        loading={accepting}
                      >
                        Annehmen
                      </Button>
                      <Button
                        size="xs"
                        variant="subtle"
                        color="gray"
                        leftSection={<IconX size={14} />}
                        onClick={() => handleDeclineInvitation(inv.id)}
                        loading={declining}
                      >
                        Ablehnen
                      </Button>
                    </Group>
                  </Group>
                </Paper>
              ))}
            </Stack>
          </Paper>
        )}

        {!!error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red">
            Fehler beim Laden der Gruppen.
          </Alert>
        )}

        {isLoading ? (
          <Stack gap="md">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} height={100} radius="md" />
            ))}
          </Stack>
        ) : groups?.length === 0 ? (
          <Paper p="xl" radius="md" withBorder ta="center">
            <IconUsers size={48} style={{ opacity: 0.3 }} />
            <Text c="dimmed" mt="md" mb="md">
              Sie sind noch keiner Gruppe beigetreten.
            </Text>
            <Button leftSection={<IconPlus size={16} />} onClick={handleOpenCreate}>
              Erste Gruppe erstellen
            </Button>
          </Paper>
        ) : (
          <Stack gap="md">
            {groups?.map((group) => (
              <Card key={group.id} p="md" radius="md" withBorder>
                <Group justify="space-between" wrap="nowrap">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Group gap="sm" mb="xs">
                      <Text fw={500} truncate>
                        {group.name}
                      </Text>
                      {getRoleBadge(group.my_role)}
                    </Group>
                    {group.description && (
                      <Text size="sm" c="dimmed" lineClamp={2}>
                        {group.description}
                      </Text>
                    )}
                    <Group gap="xs" mt="xs">
                      <Badge variant="light" size="sm" leftSection={<IconUsers size={12} />}>
                        {group.member_count} Mitglied{group.member_count !== 1 ? 'er' : ''}
                      </Badge>
                    </Group>
                  </div>
                  <Group gap="xs">
                    <Button
                      component={Link}
                      to={`/groups/${group.id}`}
                      variant="light"
                      size="sm"
                      leftSection={<IconSettings size={14} />}
                    >
                      Verwalten
                    </Button>
                  </Group>
                </Group>
              </Card>
            ))}
          </Stack>
        )}
      </Stack>

      <Modal
        opened={modalOpened}
        onClose={closeModal}
        title="Neue Gruppe erstellen"
      >
        <Stack gap="md">
          <TextInput
            label="Name"
            placeholder="z.B. Fachschaft Mathematik"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            required
          />
          <Textarea
            label="Beschreibung"
            placeholder="Optionale Beschreibung der Gruppe..."
            value={groupDescription}
            onChange={(e) => setGroupDescription(e.target.value)}
            rows={3}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={closeModal}>
              Abbrechen
            </Button>
            <Button onClick={handleCreate} loading={creating}>
              Erstellen
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
};
