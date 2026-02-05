import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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
  Menu,
  Tabs,
  Divider,
  Select,
  Avatar,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconArrowLeft,
  IconUsers,
  IconAlertCircle,
  IconEdit,
  IconTrash,
  IconUserPlus,
  IconDotsVertical,
  IconLogout,
  IconFileText,
  IconMail,
  IconX,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useAuth } from '../../services/auth/authSlice';
import {
  useGetGroupQuery,
  useGetGroupMembersQuery,
  useUpdateGroupMutation,
  useDeleteGroupMutation,
  useLeaveGroupMutation,
  useUpdateMemberRoleMutation,
  useRemoveMemberMutation,
} from '../../services/groups/groupsApi';
import {
  useGetGroupInvitationsQuery,
  useSendInvitationMutation,
  useCancelInvitationMutation,
} from '../../services/groups/invitationsApi';
import { useGetGroupQuestionsQuery } from '../../services/groups/sharingApi';
import { GroupRole } from '../../types/database';
import { InviteTeacherModal } from '../../components/groups/InviteTeacherModal';

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

const roleOptions = [
  { value: 'member', label: 'Mitglied' },
  { value: 'admin', label: 'Admin' },
];

export const GroupDetailPage = () => {
  const { id: groupId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuth();

  const [editModalOpened, { open: openEditModal, close: closeEditModal }] = useDisclosure(false);
  const [inviteModalOpened, { open: openInviteModal, close: closeInviteModal }] = useDisclosure(false);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');

  const { data: group, isLoading, error } = useGetGroupQuery(groupId || '', { skip: !groupId });
  const { data: members } = useGetGroupMembersQuery(groupId || '', { skip: !groupId });
  const { data: invitations } = useGetGroupInvitationsQuery(groupId || '', { skip: !groupId });
  const { data: sharedQuestions } = useGetGroupQuestionsQuery(groupId || '', { skip: !groupId });

  const [updateGroup, { isLoading: updating }] = useUpdateGroupMutation();
  const [deleteGroup] = useDeleteGroupMutation();
  const [leaveGroup] = useLeaveGroupMutation();
  const [updateMemberRole] = useUpdateMemberRoleMutation();
  const [removeMember] = useRemoveMemberMutation();
  const [sendInvitation, { isLoading: inviting }] = useSendInvitationMutation();
  const [cancelInvitation] = useCancelInvitationMutation();

  const isOwner = group?.my_role === 'owner';
  const isAdmin = group?.my_role === 'admin' || isOwner;

  const handleOpenEdit = () => {
    if (group) {
      setGroupName(group.name);
      setGroupDescription(group.description || '');
      openEditModal();
    }
  };

  const handleUpdate = async () => {
    if (!groupId || !groupName.trim()) return;

    try {
      await updateGroup({
        id: groupId,
        name: groupName.trim(),
        description: groupDescription.trim() || undefined,
      }).unwrap();
      notifications.show({
        title: 'Gruppe aktualisiert',
        message: 'Die Gruppe wurde erfolgreich aktualisiert.',
        color: 'green',
      });
      closeEditModal();
    } catch {
      notifications.show({
        title: 'Fehler',
        message: 'Die Gruppe konnte nicht aktualisiert werden.',
        color: 'red',
      });
    }
  };

  const handleDelete = async () => {
    if (!groupId) return;
    if (!window.confirm('Möchten Sie diese Gruppe wirklich löschen? Alle Mitglieder werden entfernt.')) return;

    try {
      await deleteGroup(groupId).unwrap();
      notifications.show({
        title: 'Gruppe gelöscht',
        message: 'Die Gruppe wurde erfolgreich gelöscht.',
        color: 'green',
      });
      navigate('/groups');
    } catch {
      notifications.show({
        title: 'Fehler',
        message: 'Die Gruppe konnte nicht gelöscht werden.',
        color: 'red',
      });
    }
  };

  const handleLeave = async () => {
    if (!groupId) return;
    if (!window.confirm('Möchten Sie diese Gruppe wirklich verlassen?')) return;

    try {
      await leaveGroup(groupId).unwrap();
      notifications.show({
        title: 'Gruppe verlassen',
        message: 'Sie haben die Gruppe verlassen.',
        color: 'green',
      });
      navigate('/groups');
    } catch {
      notifications.show({
        title: 'Fehler',
        message: 'Die Gruppe konnte nicht verlassen werden.',
        color: 'red',
      });
    }
  };

  const handleRoleChange = async (teacherId: string, newRole: string) => {
    if (!groupId) return;

    try {
      await updateMemberRole({
        groupId,
        teacherId,
        role: newRole as GroupRole,
      }).unwrap();
      notifications.show({
        title: 'Rolle geändert',
        message: 'Die Rolle wurde erfolgreich geändert.',
        color: 'green',
      });
    } catch {
      notifications.show({
        title: 'Fehler',
        message: 'Die Rolle konnte nicht geändert werden.',
        color: 'red',
      });
    }
  };

  const handleRemoveMember = async (teacherId: string, name: string) => {
    if (!groupId) return;
    if (!window.confirm(`Möchten Sie ${name} wirklich aus der Gruppe entfernen?`)) return;

    try {
      await removeMember({ groupId, teacherId }).unwrap();
      notifications.show({
        title: 'Mitglied entfernt',
        message: `${name} wurde aus der Gruppe entfernt.`,
        color: 'green',
      });
    } catch {
      notifications.show({
        title: 'Fehler',
        message: 'Das Mitglied konnte nicht entfernt werden.',
        color: 'red',
      });
    }
  };

  const handleInvite = async (email: string) => {
    if (!groupId) return;

    try {
      await sendInvitation({ groupId, email }).unwrap();
      notifications.show({
        title: 'Einladung gesendet',
        message: `Eine Einladung wurde an ${email} gesendet.`,
        color: 'green',
      });
      closeInviteModal();
    } catch (err: unknown) {
      const errorMessage = (err as { data?: { message?: string } })?.data?.message || 'Die Einladung konnte nicht gesendet werden.';
      notifications.show({
        title: 'Fehler',
        message: errorMessage,
        color: 'red',
      });
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    if (!groupId) return;

    try {
      await cancelInvitation({ invitationId, groupId }).unwrap();
      notifications.show({
        title: 'Einladung zurückgezogen',
        message: 'Die Einladung wurde zurückgezogen.',
        color: 'green',
      });
    } catch {
      notifications.show({
        title: 'Fehler',
        message: 'Die Einladung konnte nicht zurückgezogen werden.',
        color: 'red',
      });
    }
  };

  if (isLoading) {
    return (
      <Container size="lg">
        <Stack gap="lg">
          <Skeleton height={40} width={200} />
          <Skeleton height={200} />
        </Stack>
      </Container>
    );
  }

  if (error || !group) {
    return (
      <Container size="lg">
        <Alert icon={<IconAlertCircle size={16} />} color="red">
          Gruppe nicht gefunden oder Sie haben keinen Zugriff.
        </Alert>
      </Container>
    );
  }

  const pendingInvitations = invitations?.filter(i => i.status === 'pending') || [];

  return (
    <Container size="lg">
      <Stack gap="lg">
        <Group>
          <Button
            component={Link}
            to="/groups"
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
          >
            Zurück
          </Button>
        </Group>

        <Group justify="space-between">
          <div>
            <Group gap="sm">
              <Title order={2}>{group.name}</Title>
              {getRoleBadge(group.my_role)}
            </Group>
            {group.description && (
              <Text c="dimmed" mt="xs">
                {group.description}
              </Text>
            )}
          </div>
          <Group>
            {isAdmin && (
              <Button
                leftSection={<IconUserPlus size={16} />}
                onClick={openInviteModal}
              >
                Einladen
              </Button>
            )}
            <Menu shadow="md" width={200}>
              <Menu.Target>
                <ActionIcon variant="subtle" size="lg">
                  <IconDotsVertical size={18} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                {isAdmin && (
                  <>
                    <Menu.Item
                      leftSection={<IconEdit size={14} />}
                      onClick={handleOpenEdit}
                    >
                      Bearbeiten
                    </Menu.Item>
                    <Menu.Divider />
                  </>
                )}
                {isOwner ? (
                  <Menu.Item
                    color="red"
                    leftSection={<IconTrash size={14} />}
                    onClick={handleDelete}
                  >
                    Gruppe löschen
                  </Menu.Item>
                ) : (
                  <Menu.Item
                    color="red"
                    leftSection={<IconLogout size={14} />}
                    onClick={handleLeave}
                  >
                    Gruppe verlassen
                  </Menu.Item>
                )}
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>

        <Tabs defaultValue="members">
          <Tabs.List>
            <Tabs.Tab value="members" leftSection={<IconUsers size={16} />}>
              Mitglieder ({members?.length || 0})
            </Tabs.Tab>
            <Tabs.Tab value="questions" leftSection={<IconFileText size={16} />}>
              Geteilte Aufgaben ({sharedQuestions?.length || 0})
            </Tabs.Tab>
            {isAdmin && (
              <Tabs.Tab value="invitations" leftSection={<IconMail size={16} />}>
                Einladungen ({pendingInvitations.length})
              </Tabs.Tab>
            )}
          </Tabs.List>

          <Tabs.Panel value="members" pt="md">
            <Stack gap="sm">
              {members?.map((member) => (
                <Paper key={member.teacher_id} p="md" radius="md" withBorder>
                  <Group justify="space-between">
                    <Group>
                      <Avatar color="blue" radius="xl">
                        {member.profile.name.charAt(0).toUpperCase()}
                      </Avatar>
                      <div>
                        <Text fw={500}>{member.profile.name}</Text>
                        <Text size="sm" c="dimmed">
                          Beigetreten: {new Date(member.joined_at).toLocaleDateString('de-DE')}
                        </Text>
                      </div>
                    </Group>
                    <Group gap="sm">
                      {isOwner && member.role !== 'owner' ? (
                        <>
                          <Select
                            size="xs"
                            data={roleOptions}
                            value={member.role}
                            onChange={(value) => value && handleRoleChange(member.teacher_id, value)}
                            w={120}
                          />
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            onClick={() => handleRemoveMember(member.teacher_id, member.profile.name)}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </>
                      ) : (
                        getRoleBadge(member.role)
                      )}
                    </Group>
                  </Group>
                </Paper>
              ))}
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="questions" pt="md">
            {sharedQuestions?.length === 0 ? (
              <Paper p="xl" radius="md" withBorder ta="center">
                <Text c="dimmed">
                  Es wurden noch keine Aufgaben mit dieser Gruppe geteilt.
                </Text>
                <Button
                  component={Link}
                  to="/questions"
                  variant="light"
                  mt="md"
                >
                  Zu den Aufgaben
                </Button>
              </Paper>
            ) : (
              <Stack gap="sm">
                {sharedQuestions?.map((question) => (
                  <Paper key={question.id} p="md" radius="md" withBorder>
                    <Group justify="space-between">
                      <div style={{ flex: 1 }}>
                        <Group gap="sm" mb="xs">
                          <Text fw={500}>{question.title}</Text>
                          <Badge size="sm">{question.type}</Badge>
                        </Group>
                        <Text size="sm" c="dimmed" lineClamp={1}>
                          {(question.content as { question: string }).question}
                        </Text>
                        {question.shared_by_profile && (
                          <Text size="xs" c="dimmed" mt="xs">
                            Geteilt von: {question.shared_by_profile.name}
                          </Text>
                        )}
                      </div>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            )}
          </Tabs.Panel>

          {isAdmin && (
            <Tabs.Panel value="invitations" pt="md">
              {pendingInvitations.length === 0 ? (
                <Paper p="xl" radius="md" withBorder ta="center">
                  <Text c="dimmed">
                    Keine ausstehenden Einladungen.
                  </Text>
                  <Button
                    leftSection={<IconUserPlus size={16} />}
                    variant="light"
                    mt="md"
                    onClick={openInviteModal}
                  >
                    Jemanden einladen
                  </Button>
                </Paper>
              ) : (
                <Stack gap="sm">
                  {pendingInvitations.map((invitation) => (
                    <Paper key={invitation.id} p="md" radius="md" withBorder>
                      <Group justify="space-between">
                        <div>
                          <Text fw={500}>{invitation.invited_email}</Text>
                          <Text size="sm" c="dimmed">
                            Eingeladen am: {new Date(invitation.created_at).toLocaleDateString('de-DE')}
                          </Text>
                        </div>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          onClick={() => handleCancelInvitation(invitation.id)}
                        >
                          <IconX size={16} />
                        </ActionIcon>
                      </Group>
                    </Paper>
                  ))}
                </Stack>
              )}
            </Tabs.Panel>
          )}
        </Tabs>
      </Stack>

      {/* Edit Group Modal */}
      <Modal
        opened={editModalOpened}
        onClose={closeEditModal}
        title="Gruppe bearbeiten"
      >
        <Stack gap="md">
          <TextInput
            label="Name"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            required
          />
          <Textarea
            label="Beschreibung"
            value={groupDescription}
            onChange={(e) => setGroupDescription(e.target.value)}
            rows={3}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={closeEditModal}>
              Abbrechen
            </Button>
            <Button onClick={handleUpdate} loading={updating}>
              Speichern
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Invite Modal */}
      <InviteTeacherModal
        opened={inviteModalOpened}
        onClose={closeInviteModal}
        onInvite={handleInvite}
        loading={inviting}
      />
    </Container>
  );
};
