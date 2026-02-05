import { useState, useEffect } from 'react';
import {
  Modal,
  Stack,
  Button,
  Group,
  Text,
  Checkbox,
  Paper,
  Skeleton,
  Alert,
} from '@mantine/core';
import { IconUsers, IconAlertCircle } from '@tabler/icons-react';
import { useGetMyGroupsQuery } from '../../services/groups/groupsApi';
import {
  useGetQuestionSharesQuery,
  useShareQuestionMutation,
  useUnshareQuestionMutation,
} from '../../services/groups/sharingApi';
import { notifications } from '@mantine/notifications';

interface ShareQuestionModalProps {
  opened: boolean;
  onClose: () => void;
  questionId: string;
  questionTitle: string;
}

export const ShareQuestionModal = ({
  opened,
  onClose,
  questionId,
  questionTitle,
}: ShareQuestionModalProps) => {
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());

  const { data: groups, isLoading: loadingGroups } = useGetMyGroupsQuery();
  const { data: currentShares, isLoading: loadingShares } = useGetQuestionSharesQuery(questionId, {
    skip: !opened || !questionId,
  });
  const [shareQuestion, { isLoading: sharing }] = useShareQuestionMutation();
  const [unshareQuestion, { isLoading: unsharing }] = useUnshareQuestionMutation();

  // Initialize selected groups from current shares
  useEffect(() => {
    if (currentShares) {
      setSelectedGroups(new Set(currentShares.map(s => s.group_id)));
    }
  }, [currentShares]);

  const handleClose = () => {
    onClose();
  };

  const handleToggleGroup = (groupId: string) => {
    setSelectedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const handleSave = async () => {
    const currentShareIds = new Set(currentShares?.map(s => s.group_id) || []);

    // Groups to add (selected but not currently shared)
    const toAdd = Array.from(selectedGroups).filter(id => !currentShareIds.has(id));

    // Groups to remove (currently shared but not selected)
    const toRemove = Array.from(currentShareIds).filter(id => !selectedGroups.has(id));

    try {
      // Add new shares
      if (toAdd.length > 0) {
        await shareQuestion({ questionId, groupIds: toAdd }).unwrap();
      }

      // Remove old shares
      for (const groupId of toRemove) {
        await unshareQuestion({ questionId, groupId }).unwrap();
      }

      notifications.show({
        title: 'Freigabe aktualisiert',
        message: 'Die Aufgabe wurde aktualisiert.',
        color: 'green',
      });
      handleClose();
    } catch {
      notifications.show({
        title: 'Fehler',
        message: 'Die Freigabe konnte nicht aktualisiert werden.',
        color: 'red',
      });
    }
  };

  const isLoading = loadingGroups || loadingShares;
  const isSaving = sharing || unsharing;

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Aufgabe teilen"
      size="md"
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Wählen Sie die Gruppen aus, mit denen Sie die Aufgabe "{questionTitle}" teilen möchten.
          Mitglieder dieser Gruppen können die Aufgabe sehen und in ihre Prüfungen einfügen oder kopieren.
        </Text>

        {isLoading ? (
          <Stack gap="sm">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} height={50} radius="md" />
            ))}
          </Stack>
        ) : groups?.length === 0 ? (
          <Alert icon={<IconAlertCircle size={16} />} color="blue">
            Sie sind noch keiner Gruppe beigetreten. Erstellen Sie eine Gruppe oder treten Sie einer bei, um Aufgaben zu teilen.
          </Alert>
        ) : (
          <Stack gap="xs">
            {groups?.map(group => (
              <Paper
                key={group.id}
                p="sm"
                radius="md"
                withBorder
                style={{ cursor: 'pointer' }}
                onClick={() => handleToggleGroup(group.id)}
              >
                <Group justify="space-between">
                  <Group gap="sm">
                    <IconUsers size={20} style={{ opacity: 0.5 }} />
                    <div>
                      <Text fw={500} size="sm">{group.name}</Text>
                      <Text size="xs" c="dimmed">
                        {group.member_count} Mitglied{group.member_count !== 1 ? 'er' : ''}
                      </Text>
                    </div>
                  </Group>
                  <Checkbox
                    checked={selectedGroups.has(group.id)}
                    onChange={() => handleToggleGroup(group.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </Group>
              </Paper>
            ))}
          </Stack>
        )}

        <Group justify="flex-end">
          <Button variant="subtle" onClick={handleClose}>
            Abbrechen
          </Button>
          <Button
            onClick={handleSave}
            loading={isSaving}
            disabled={groups?.length === 0}
          >
            Speichern
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};
