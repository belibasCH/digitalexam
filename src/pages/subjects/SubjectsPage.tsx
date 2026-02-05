import { useState } from 'react';
import {
  Container,
  Title,
  Text,
  Paper,
  Button,
  Group,
  Stack,
  TextInput,
  ActionIcon,
  Skeleton,
  Alert,
  Modal,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus, IconEdit, IconTrash, IconAlertCircle } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useAuth } from '../../services/auth/authSlice';
import {
  useGetSubjectsQuery,
  useCreateSubjectMutation,
  useUpdateSubjectMutation,
  useDeleteSubjectMutation,
} from '../../services/subjects/subjectsApi';

export const SubjectsPage = () => {
  const user = useAuth();
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [subjectName, setSubjectName] = useState('');

  const { data: subjects, isLoading, error } = useGetSubjectsQuery(user?.id || '', {
    skip: !user?.id,
  });

  const [createSubject, { isLoading: creating }] = useCreateSubjectMutation();
  const [updateSubject, { isLoading: updating }] = useUpdateSubjectMutation();
  const [deleteSubject] = useDeleteSubjectMutation();

  const handleOpenCreate = () => {
    setEditingId(null);
    setSubjectName('');
    openModal();
  };

  const handleOpenEdit = (id: string, name: string) => {
    setEditingId(id);
    setSubjectName(name);
    openModal();
  };

  const handleSave = async () => {
    if (!subjectName.trim()) {
      notifications.show({
        title: 'Fehler',
        message: 'Bitte geben Sie einen Namen ein.',
        color: 'red',
      });
      return;
    }

    try {
      if (editingId) {
        await updateSubject({ id: editingId, name: subjectName.trim() }).unwrap();
        notifications.show({
          title: 'Fach aktualisiert',
          message: 'Das Fach wurde erfolgreich aktualisiert.',
          color: 'green',
        });
      } else {
        await createSubject({
          teacher_id: user!.id,
          name: subjectName.trim(),
        }).unwrap();
        notifications.show({
          title: 'Fach erstellt',
          message: 'Das neue Fach wurde erstellt.',
          color: 'green',
        });
      }
      closeModal();
    } catch {
      notifications.show({
        title: 'Fehler',
        message: 'Das Fach konnte nicht gespeichert werden.',
        color: 'red',
      });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Möchten Sie das Fach "${name}" wirklich löschen?`)) {
      return;
    }

    try {
      await deleteSubject(id).unwrap();
      notifications.show({
        title: 'Fach gelöscht',
        message: 'Das Fach wurde erfolgreich gelöscht.',
        color: 'green',
      });
    } catch {
      notifications.show({
        title: 'Fehler',
        message: 'Das Fach konnte nicht gelöscht werden.',
        color: 'red',
      });
    }
  };

  return (
    <Container size="md">
      <Stack gap="lg">
        <Group justify="space-between">
          <div>
            <Title order={2}>Fächer</Title>
            <Text c="dimmed" mt="xs">
              Verwalten Sie Ihre Fächer, um Aufgaben zu kategorisieren
            </Text>
          </div>
          <Button leftSection={<IconPlus size={16} />} onClick={handleOpenCreate}>
            Neues Fach
          </Button>
        </Group>

        {!!error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red">
            Fehler beim Laden der Fächer.
          </Alert>
        )}

        {isLoading ? (
          <Stack gap="sm">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} height={60} radius="md" />
            ))}
          </Stack>
        ) : subjects?.length === 0 ? (
          <Paper p="xl" radius="md" withBorder ta="center">
            <Text c="dimmed" mb="md">
              Sie haben noch keine Fächer erstellt.
            </Text>
            <Button leftSection={<IconPlus size={16} />} onClick={handleOpenCreate}>
              Erstes Fach erstellen
            </Button>
          </Paper>
        ) : (
          <Stack gap="sm">
            {subjects?.map((subject) => (
              <Paper key={subject.id} p="md" radius="md" withBorder>
                <Group justify="space-between">
                  <Text fw={500}>{subject.name}</Text>
                  <Group gap="xs">
                    <ActionIcon
                      variant="subtle"
                      onClick={() => handleOpenEdit(subject.id, subject.name)}
                    >
                      <IconEdit size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => handleDelete(subject.id, subject.name)}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Group>
              </Paper>
            ))}
          </Stack>
        )}
      </Stack>

      <Modal
        opened={modalOpened}
        onClose={closeModal}
        title={editingId ? 'Fach bearbeiten' : 'Neues Fach'}
      >
        <Stack gap="md">
          <TextInput
            label="Name"
            placeholder="z.B. Mathematik, Deutsch, Geschichte..."
            value={subjectName}
            onChange={(e) => setSubjectName(e.target.value)}
            required
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={closeModal}>
              Abbrechen
            </Button>
            <Button onClick={handleSave} loading={creating || updating}>
              {editingId ? 'Speichern' : 'Erstellen'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
};
