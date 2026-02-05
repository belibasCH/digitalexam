import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Container,
  Title,
  Text,
  Paper,
  TextInput,
  Textarea,
  NumberInput,
  Button,
  Group,
  Stack,
  SegmentedControl,
  ActionIcon,
  Checkbox,
  Alert,
  Skeleton,
  MultiSelect,
  Select,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconPlus, IconTrash, IconAlertCircle } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useAuth } from '../../services/auth/authSlice';
import {
  useGetQuestionQuery,
  useCreateQuestionMutation,
  useUpdateQuestionMutation,
} from '../../services/questions/questionsApi';
import {
  MultipleChoiceContent,
  FreeTextContent,
  FileUploadContent,
  MultipleChoiceOption,
} from '../../types/database';

interface FormValues {
  title: string;
  type: 'multiple_choice' | 'free_text' | 'file_upload';
  points: number;
  question: string;
  // Multiple choice specific
  options: MultipleChoiceOption[];
  // Free text specific
  expected_length: 'short' | 'medium' | 'long';
  sample_answer: string;
  // File upload specific
  allowed_types: string[];
  max_file_size_mb: number;
  max_files: number;
}

const generateId = () => Math.random().toString(36).substring(2, 11);

const FILE_TYPE_OPTIONS = [
  { value: 'pdf', label: 'PDF' },
  { value: 'doc', label: 'Word (DOC)' },
  { value: 'docx', label: 'Word (DOCX)' },
  { value: 'txt', label: 'Text (TXT)' },
  { value: 'jpg', label: 'Bild (JPG)' },
  { value: 'jpeg', label: 'Bild (JPEG)' },
  { value: 'png', label: 'Bild (PNG)' },
  { value: 'gif', label: 'Bild (GIF)' },
  { value: 'zip', label: 'Archiv (ZIP)' },
  { value: 'xlsx', label: 'Excel (XLSX)' },
  { value: 'pptx', label: 'PowerPoint (PPTX)' },
];

export const QuestionEditorPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuth();
  const isEditing = !!id;

  const { data: existingQuestion, isLoading: loadingQuestion } = useGetQuestionQuery(id || '', {
    skip: !id,
  });

  const [createQuestion, { isLoading: creating }] = useCreateQuestionMutation();
  const [updateQuestion, { isLoading: updating }] = useUpdateQuestionMutation();

  const form = useForm<FormValues>({
    initialValues: {
      title: '',
      type: 'multiple_choice',
      points: 1,
      question: '',
      options: [
        { id: generateId(), text: '', is_correct: true },
        { id: generateId(), text: '', is_correct: false },
      ],
      expected_length: 'medium',
      sample_answer: '',
      allowed_types: ['pdf', 'docx', 'jpg', 'png'],
      max_file_size_mb: 10,
      max_files: 1,
    },
    validate: {
      title: (value) => (value.length > 0 ? null : 'Titel ist erforderlich'),
      question: (value) => (value.length > 0 ? null : 'Fragetext ist erforderlich'),
      options: (value, values) => {
        if (values.type !== 'multiple_choice') return null;
        if (value.length < 2) return 'Mindestens 2 Optionen erforderlich';
        if (value.some((o) => !o.text.trim())) return 'Alle Optionen müssen Text haben';
        if (!value.some((o) => o.is_correct)) return 'Mindestens eine richtige Antwort erforderlich';
        return null;
      },
      allowed_types: (value, values) => {
        if (values.type !== 'file_upload') return null;
        if (value.length === 0) return 'Mindestens ein Dateityp muss erlaubt sein';
        return null;
      },
    },
  });

  useEffect(() => {
    if (existingQuestion) {
      const content = existingQuestion.content;
      if (existingQuestion.type === 'multiple_choice') {
        const mcContent = content as MultipleChoiceContent;
        form.setValues({
          title: existingQuestion.title,
          type: 'multiple_choice',
          points: existingQuestion.points,
          question: mcContent.question,
          options: mcContent.options,
          expected_length: 'medium',
          sample_answer: '',
          allowed_types: ['pdf', 'docx', 'jpg', 'png'],
          max_file_size_mb: 10,
          max_files: 1,
        });
      } else if (existingQuestion.type === 'free_text') {
        const ftContent = content as FreeTextContent;
        form.setValues({
          title: existingQuestion.title,
          type: 'free_text',
          points: existingQuestion.points,
          question: ftContent.question,
          options: [
            { id: generateId(), text: '', is_correct: true },
            { id: generateId(), text: '', is_correct: false },
          ],
          expected_length: ftContent.expected_length || 'medium',
          sample_answer: ftContent.sample_answer || '',
          allowed_types: ['pdf', 'docx', 'jpg', 'png'],
          max_file_size_mb: 10,
          max_files: 1,
        });
      } else if (existingQuestion.type === 'file_upload') {
        const fuContent = content as FileUploadContent;
        form.setValues({
          title: existingQuestion.title,
          type: 'file_upload',
          points: existingQuestion.points,
          question: fuContent.question,
          options: [
            { id: generateId(), text: '', is_correct: true },
            { id: generateId(), text: '', is_correct: false },
          ],
          expected_length: 'medium',
          sample_answer: '',
          allowed_types: fuContent.allowed_types || ['pdf', 'docx', 'jpg', 'png'],
          max_file_size_mb: fuContent.max_file_size_mb || 10,
          max_files: fuContent.max_files || 1,
        });
      }
    }
  }, [existingQuestion]);

  const handleSubmit = async (values: FormValues) => {
    if (!user?.id) return;

    let content: MultipleChoiceContent | FreeTextContent | FileUploadContent;

    if (values.type === 'multiple_choice') {
      content = {
        question: values.question,
        options: values.options,
      };
    } else if (values.type === 'free_text') {
      content = {
        question: values.question,
        expected_length: values.expected_length,
        sample_answer: values.sample_answer || undefined,
      };
    } else {
      content = {
        question: values.question,
        allowed_types: values.allowed_types,
        max_file_size_mb: values.max_file_size_mb,
        max_files: values.max_files,
      };
    }

    try {
      if (isEditing && id) {
        await updateQuestion({
          id,
          data: {
            title: values.title,
            type: values.type,
            points: values.points,
            content,
          },
        }).unwrap();
        notifications.show({
          title: 'Aufgabe aktualisiert',
          message: 'Die Änderungen wurden gespeichert.',
          color: 'green',
        });
      } else {
        await createQuestion({
          teacher_id: user.id,
          title: values.title,
          type: values.type,
          points: values.points,
          content,
        }).unwrap();
        notifications.show({
          title: 'Aufgabe erstellt',
          message: 'Die neue Aufgabe wurde erstellt.',
          color: 'green',
        });
      }
      navigate('/questions');
    } catch {
      notifications.show({
        title: 'Fehler',
        message: 'Die Aufgabe konnte nicht gespeichert werden.',
        color: 'red',
      });
    }
  };

  const addOption = () => {
    form.setFieldValue('options', [
      ...form.values.options,
      { id: generateId(), text: '', is_correct: false },
    ]);
  };

  const removeOption = (index: number) => {
    if (form.values.options.length <= 2) return;
    form.setFieldValue(
      'options',
      form.values.options.filter((_, i) => i !== index)
    );
  };

  const setCorrectOption = (index: number, checked: boolean) => {
    const newOptions = [...form.values.options];
    newOptions[index] = { ...newOptions[index], is_correct: checked };
    form.setFieldValue('options', newOptions);
  };

  if (isEditing && loadingQuestion) {
    return (
      <Container size="md">
        <Stack gap="md">
          <Skeleton height={40} />
          <Skeleton height={200} />
        </Stack>
      </Container>
    );
  }

  return (
    <Container size="md">
      <Stack gap="lg">
        <div>
          <Title order={2}>{isEditing ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'}</Title>
          <Text c="dimmed" mt="xs">
            {isEditing
              ? 'Bearbeiten Sie die Aufgabe'
              : 'Erstellen Sie eine neue Aufgabe für Ihre Prüfungen'}
          </Text>
        </div>

        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Paper p="lg" radius="md" withBorder>
            <Stack gap="md">
              <TextInput
                label="Titel"
                placeholder="z.B. Hauptstädte Europas"
                required
                {...form.getInputProps('title')}
              />

              <Group grow>
                <div>
                  <Text size="sm" fw={500} mb="xs">
                    Aufgabentyp
                  </Text>
                  <SegmentedControl
                    fullWidth
                    data={[
                      { value: 'multiple_choice', label: 'Multiple Choice' },
                      { value: 'free_text', label: 'Freitext' },
                      { value: 'file_upload', label: 'Dateiupload' },
                    ]}
                    {...form.getInputProps('type')}
                  />
                </div>
                <NumberInput
                  label="Punkte"
                  min={1}
                  max={100}
                  {...form.getInputProps('points')}
                />
              </Group>

              <Textarea
                label="Fragetext"
                placeholder="Geben Sie hier die Frage ein..."
                minRows={3}
                required
                {...form.getInputProps('question')}
              />

              {form.values.type === 'multiple_choice' && (
                <div>
                  <Text size="sm" fw={500} mb="xs">
                    Antwortmöglichkeiten
                  </Text>
                  {form.errors.options && (
                    <Alert icon={<IconAlertCircle size={16} />} color="red" mb="sm">
                      {form.errors.options}
                    </Alert>
                  )}
                  <Stack gap="sm">
                    {form.values.options.map((option, index) => (
                      <Group key={option.id} gap="sm">
                        <Checkbox
                          checked={option.is_correct}
                          onChange={(e) => setCorrectOption(index, e.currentTarget.checked)}
                          label="Richtig"
                        />
                        <TextInput
                          style={{ flex: 1 }}
                          placeholder={`Option ${index + 1}`}
                          value={option.text}
                          onChange={(e) => {
                            const newOptions = [...form.values.options];
                            newOptions[index] = { ...newOptions[index], text: e.target.value };
                            form.setFieldValue('options', newOptions);
                          }}
                        />
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          onClick={() => removeOption(index)}
                          disabled={form.values.options.length <= 2}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                    ))}
                    <Button
                      variant="light"
                      leftSection={<IconPlus size={16} />}
                      onClick={addOption}
                    >
                      Option hinzufügen
                    </Button>
                  </Stack>
                </div>
              )}

              {form.values.type === 'free_text' && (
                <>
                  <div>
                    <Text size="sm" fw={500} mb="xs">
                      Erwartete Antwortlänge
                    </Text>
                    <SegmentedControl
                      fullWidth
                      data={[
                        { value: 'short', label: 'Kurz' },
                        { value: 'medium', label: 'Mittel' },
                        { value: 'long', label: 'Lang' },
                      ]}
                      {...form.getInputProps('expected_length')}
                    />
                  </div>
                  <Textarea
                    label="Musterlösung (optional)"
                    placeholder="Geben Sie hier eine Musterlösung ein..."
                    minRows={3}
                    {...form.getInputProps('sample_answer')}
                  />
                </>
              )}

              {form.values.type === 'file_upload' && (
                <>
                  <MultiSelect
                    label="Erlaubte Dateitypen"
                    placeholder="Wählen Sie erlaubte Dateitypen..."
                    data={FILE_TYPE_OPTIONS}
                    searchable
                    {...form.getInputProps('allowed_types')}
                    error={form.errors.allowed_types}
                  />
                  <Group grow>
                    <NumberInput
                      label="Maximale Dateigröße (MB)"
                      min={1}
                      max={100}
                      {...form.getInputProps('max_file_size_mb')}
                    />
                    <NumberInput
                      label="Maximale Anzahl Dateien"
                      min={1}
                      max={10}
                      {...form.getInputProps('max_files')}
                    />
                  </Group>
                  <Alert color="blue" variant="light">
                    Schüler können Dateien der ausgewählten Typen bis zur angegebenen Größe hochladen.
                  </Alert>
                </>
              )}

              <Group justify="flex-end" mt="md">
                <Button variant="subtle" onClick={() => navigate('/questions')}>
                  Abbrechen
                </Button>
                <Button type="submit" loading={creating || updating}>
                  {isEditing ? 'Speichern' : 'Erstellen'}
                </Button>
              </Group>
            </Stack>
          </Paper>
        </form>
      </Stack>
    </Container>
  );
};
