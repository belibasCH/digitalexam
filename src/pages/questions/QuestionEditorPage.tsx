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
  ActionIcon,
  Checkbox,
  Alert,
  Skeleton,
  MultiSelect,
  Select,
  Switch,
  Tabs,
  Badge,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconPlus, IconTrash, IconAlertCircle, IconGripVertical } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useAuth } from '../../services/auth/authSlice';
import {
  useGetQuestionQuery,
  useCreateQuestionMutation,
  useUpdateQuestionMutation,
} from '../../services/questions/questionsApi';
import { useGetSubjectsQuery } from '../../services/subjects/subjectsApi';
import {
  QuestionType,
  QuestionContent,
  BloomLevel,
  BLOOM_LEVELS,
  MultipleChoiceContent,
  FreeTextContent,
  FileUploadContent,
  KPrimContent,
  ClozeContent,
  MatchingContent,
  EssayContent,
  MultipleChoiceOption,
  KPrimStatement,
  ClozeBlank,
  MatchingPair,
} from '../../types/database';

interface FormValues {
  title: string;
  type: QuestionType;
  points: number;
  question: string;
  bloom_level: BloomLevel | '';
  subject_id: string | '';
  // Multiple choice
  options: MultipleChoiceOption[];
  // Free text
  expected_length: 'word' | 'short' | 'medium' | 'long';
  sample_answer: string;
  // File upload
  allowed_types: string[];
  max_file_size_mb: number;
  max_files: number;
  // K-Prim
  kprim_statements: KPrimStatement[];
  // Cloze
  cloze_text: string;
  cloze_blanks: ClozeBlank[];
  // Matching
  matching_pairs: MatchingPair[];
  // Essay
  min_words: number | undefined;
  max_words: number | undefined;
  rubric: string;
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

const QUESTION_TYPE_OPTIONS: { value: QuestionType; label: string; description: string }[] = [
  { value: 'multiple_choice', label: 'Multiple Choice', description: 'Eine oder mehrere richtige Antworten' },
  { value: 'kprim', label: 'K-Prim', description: '4 Aussagen, jeweils richtig oder falsch' },
  { value: 'free_text', label: 'Freitext', description: 'Kurze bis mittlere Textantwort' },
  { value: 'essay', label: 'Aufsatz', description: 'Längere Textantwort mit Wortlimit' },
  { value: 'cloze', label: 'Lückentext', description: 'Text mit auszufüllenden Lücken' },
  { value: 'matching', label: 'Zuordnung', description: 'Elemente einander zuordnen' },
  { value: 'file_upload', label: 'Dateiupload', description: 'Datei hochladen als Antwort' },
];

const getDefaultFormValues = (): FormValues => ({
  title: '',
  type: 'multiple_choice',
  points: 1,
  question: '',
  bloom_level: '',
  subject_id: '',
  options: [
    { id: generateId(), text: '', is_correct: true },
    { id: generateId(), text: '', is_correct: false },
  ],
  expected_length: 'medium',
  sample_answer: '',
  allowed_types: ['pdf', 'docx', 'jpg', 'png'],
  max_file_size_mb: 10,
  max_files: 1,
  kprim_statements: [
    { id: generateId(), text: '', is_true: true },
    { id: generateId(), text: '', is_true: false },
    { id: generateId(), text: '', is_true: true },
    { id: generateId(), text: '', is_true: false },
  ],
  cloze_text: '',
  cloze_blanks: [],
  matching_pairs: [
    { id: generateId(), left: '', right: '' },
    { id: generateId(), left: '', right: '' },
  ],
  min_words: undefined,
  max_words: undefined,
  rubric: '',
});

export const QuestionEditorPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuth();
  const isEditing = !!id;

  const { data: existingQuestion, isLoading: loadingQuestion } = useGetQuestionQuery(id || '', {
    skip: !id,
  });

  const { data: subjects } = useGetSubjectsQuery(user?.id || '', {
    skip: !user?.id,
  });

  const [createQuestion, { isLoading: creating }] = useCreateQuestionMutation();
  const [updateQuestion, { isLoading: updating }] = useUpdateQuestionMutation();

  const form = useForm<FormValues>({
    initialValues: getDefaultFormValues(),
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
      kprim_statements: (value, values) => {
        if (values.type !== 'kprim') return null;
        if (value.length !== 4) return 'K-Prim benötigt genau 4 Aussagen';
        if (value.some((s) => !s.text.trim())) return 'Alle Aussagen müssen Text haben';
        return null;
      },
      cloze_text: (value, values) => {
        if (values.type !== 'cloze') return null;
        if (!value.includes('{{')) return 'Lückentext muss mindestens eine Lücke {{id}} enthalten';
        return null;
      },
      matching_pairs: (value, values) => {
        if (values.type !== 'matching') return null;
        if (value.length < 2) return 'Mindestens 2 Paare erforderlich';
        if (value.some((p) => !p.left.trim() || !p.right.trim())) return 'Alle Paare müssen ausgefüllt sein';
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
      const baseValues = {
        title: existingQuestion.title,
        type: existingQuestion.type,
        points: existingQuestion.points,
        bloom_level: (existingQuestion.bloom_level || '') as BloomLevel | '',
        subject_id: existingQuestion.subject_id || '',
      };

      switch (existingQuestion.type) {
        case 'multiple_choice': {
          const mc = content as MultipleChoiceContent;
          form.setValues({
            ...getDefaultFormValues(),
            ...baseValues,
            question: mc.question,
            options: mc.options,
          });
          break;
        }
        case 'free_text': {
          const ft = content as FreeTextContent;
          form.setValues({
            ...getDefaultFormValues(),
            ...baseValues,
            question: ft.question,
            expected_length: ft.expected_length || 'medium',
            sample_answer: ft.sample_answer || '',
          });
          break;
        }
        case 'file_upload': {
          const fu = content as FileUploadContent;
          form.setValues({
            ...getDefaultFormValues(),
            ...baseValues,
            question: fu.question,
            allowed_types: fu.allowed_types || ['pdf', 'docx', 'jpg', 'png'],
            max_file_size_mb: fu.max_file_size_mb || 10,
            max_files: fu.max_files || 1,
          });
          break;
        }
        case 'kprim': {
          const kp = content as KPrimContent;
          form.setValues({
            ...getDefaultFormValues(),
            ...baseValues,
            question: kp.question,
            kprim_statements: kp.statements,
          });
          break;
        }
        case 'cloze': {
          const cl = content as ClozeContent;
          form.setValues({
            ...getDefaultFormValues(),
            ...baseValues,
            question: cl.question,
            cloze_text: cl.text,
            cloze_blanks: cl.blanks,
          });
          break;
        }
        case 'matching': {
          const ma = content as MatchingContent;
          form.setValues({
            ...getDefaultFormValues(),
            ...baseValues,
            question: ma.question,
            matching_pairs: ma.pairs,
          });
          break;
        }
        case 'essay': {
          const es = content as EssayContent;
          form.setValues({
            ...getDefaultFormValues(),
            ...baseValues,
            question: es.question,
            min_words: es.min_words,
            max_words: es.max_words,
            rubric: es.rubric || '',
          });
          break;
        }
      }
    }
  }, [existingQuestion]);

  const buildContent = (values: FormValues): QuestionContent => {
    switch (values.type) {
      case 'multiple_choice':
        return {
          question: values.question,
          options: values.options,
        };
      case 'free_text':
        return {
          question: values.question,
          expected_length: values.expected_length,
          sample_answer: values.sample_answer || undefined,
        };
      case 'file_upload':
        return {
          question: values.question,
          allowed_types: values.allowed_types,
          max_file_size_mb: values.max_file_size_mb,
          max_files: values.max_files,
        };
      case 'kprim':
        return {
          question: values.question,
          statements: values.kprim_statements,
        };
      case 'cloze':
        return {
          question: values.question,
          text: values.cloze_text,
          blanks: values.cloze_blanks,
        };
      case 'matching':
        return {
          question: values.question,
          pairs: values.matching_pairs,
        };
      case 'essay':
        return {
          question: values.question,
          min_words: values.min_words,
          max_words: values.max_words,
          rubric: values.rubric || undefined,
        };
    }
  };

  const handleSubmit = async (values: FormValues) => {
    if (!user?.id) return;

    const content = buildContent(values);

    try {
      if (isEditing && id) {
        await updateQuestion({
          id,
          data: {
            title: values.title,
            type: values.type,
            points: values.points,
            content,
            bloom_level: values.bloom_level || undefined,
            subject_id: values.subject_id || undefined,
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
          bloom_level: values.bloom_level || undefined,
          subject_id: values.subject_id || undefined,
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

  // Multiple Choice helpers
  const addOption = () => {
    form.setFieldValue('options', [
      ...form.values.options,
      { id: generateId(), text: '', is_correct: false },
    ]);
  };

  const removeOption = (index: number) => {
    if (form.values.options.length <= 2) return;
    form.setFieldValue('options', form.values.options.filter((_, i) => i !== index));
  };

  // Matching helpers
  const addMatchingPair = () => {
    form.setFieldValue('matching_pairs', [
      ...form.values.matching_pairs,
      { id: generateId(), left: '', right: '' },
    ]);
  };

  const removeMatchingPair = (index: number) => {
    if (form.values.matching_pairs.length <= 2) return;
    form.setFieldValue('matching_pairs', form.values.matching_pairs.filter((_, i) => i !== index));
  };

  // Cloze helpers
  const parseClozeText = (text: string) => {
    const regex = /\{\{(\w+)\}\}/g;
    const matches = [...text.matchAll(regex)];
    const blankIds = matches.map(m => m[1]);

    // Update blanks - keep existing ones, add new ones
    const existingBlanks = form.values.cloze_blanks;
    const newBlanks: ClozeBlank[] = blankIds.map(id => {
      const existing = existingBlanks.find(b => b.id === id);
      return existing || { id, correct_answers: [''], case_sensitive: false };
    });

    form.setFieldValue('cloze_blanks', newBlanks);
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

  const subjectOptions = subjects?.map(s => ({ value: s.id, label: s.name })) || [];
  const bloomOptions = BLOOM_LEVELS.map(b => ({ value: b.value, label: `${b.label} - ${b.description}` }));

  return (
    <Container size="lg">
      <Stack gap="lg">
        <div>
          <Title order={2}>{isEditing ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'}</Title>
          <Text c="dimmed" mt="xs">
            {isEditing ? 'Bearbeiten Sie die Aufgabe' : 'Erstellen Sie eine neue Aufgabe für Ihre Prüfungen'}
          </Text>
        </div>

        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="lg">
            {/* Basic Info */}
            <Paper p="lg" radius="md" withBorder>
              <Title order={4} mb="md">Grundinformationen</Title>
              <Stack gap="md">
                <TextInput
                  label="Titel"
                  placeholder="z.B. Hauptstädte Europas"
                  required
                  {...form.getInputProps('title')}
                />

                <Group grow>
                  <Select
                    label="Fach"
                    placeholder="Fach auswählen..."
                    data={subjectOptions}
                    clearable
                    searchable
                    value={form.values.subject_id || null}
                    onChange={(value) => form.setFieldValue('subject_id', value || '')}
                  />
                  <Select
                    label="Bloom-Taxonomie"
                    placeholder="Stufe auswählen..."
                    data={bloomOptions}
                    clearable
                    value={form.values.bloom_level || null}
                    onChange={(value) => form.setFieldValue('bloom_level', (value as BloomLevel) || '')}
                  />
                  <NumberInput
                    label="Punkte"
                    min={1}
                    max={100}
                    {...form.getInputProps('points')}
                  />
                </Group>
              </Stack>
            </Paper>

            {/* Question Type */}
            <Paper p="lg" radius="md" withBorder>
              <Title order={4} mb="md">Aufgabentyp</Title>
              <Tabs value={form.values.type} onChange={(value) => form.setFieldValue('type', value as QuestionType)}>
                <Tabs.List>
                  {QUESTION_TYPE_OPTIONS.map(opt => (
                    <Tabs.Tab key={opt.value} value={opt.value}>
                      {opt.label}
                    </Tabs.Tab>
                  ))}
                </Tabs.List>
              </Tabs>
              <Text size="sm" c="dimmed" mt="sm">
                {QUESTION_TYPE_OPTIONS.find(o => o.value === form.values.type)?.description}
              </Text>
            </Paper>

            {/* Question Content */}
            <Paper p="lg" radius="md" withBorder>
              <Title order={4} mb="md">Aufgabeninhalt</Title>
              <Stack gap="md">
                <Textarea
                  label="Fragetext"
                  placeholder="Geben Sie hier die Frage ein..."
                  minRows={3}
                  required
                  {...form.getInputProps('question')}
                />

                {/* Multiple Choice */}
                {form.values.type === 'multiple_choice' && (
                  <div>
                    <Text size="sm" fw={500} mb="xs">Antwortmöglichkeiten</Text>
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
                            onChange={(e) => {
                              const newOptions = [...form.values.options];
                              newOptions[index] = { ...newOptions[index], is_correct: e.currentTarget.checked };
                              form.setFieldValue('options', newOptions);
                            }}
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
                          <ActionIcon variant="subtle" color="red" onClick={() => removeOption(index)} disabled={form.values.options.length <= 2}>
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Group>
                      ))}
                      <Button variant="light" leftSection={<IconPlus size={16} />} onClick={addOption}>
                        Option hinzufügen
                      </Button>
                    </Stack>
                  </div>
                )}

                {/* K-Prim */}
                {form.values.type === 'kprim' && (
                  <div>
                    <Text size="sm" fw={500} mb="xs">4 Aussagen (Schüler markieren jede als richtig oder falsch)</Text>
                    {form.errors.kprim_statements && (
                      <Alert icon={<IconAlertCircle size={16} />} color="red" mb="sm">
                        {form.errors.kprim_statements}
                      </Alert>
                    )}
                    <Stack gap="sm">
                      {form.values.kprim_statements.map((statement, index) => (
                        <Group key={statement.id} gap="sm">
                          <Badge w={30}>{index + 1}</Badge>
                          <TextInput
                            style={{ flex: 1 }}
                            placeholder={`Aussage ${index + 1}`}
                            value={statement.text}
                            onChange={(e) => {
                              const newStatements = [...form.values.kprim_statements];
                              newStatements[index] = { ...newStatements[index], text: e.target.value };
                              form.setFieldValue('kprim_statements', newStatements);
                            }}
                          />
                          <Switch
                            label={statement.is_true ? 'Richtig' : 'Falsch'}
                            checked={statement.is_true}
                            onChange={(e) => {
                              const newStatements = [...form.values.kprim_statements];
                              newStatements[index] = { ...newStatements[index], is_true: e.currentTarget.checked };
                              form.setFieldValue('kprim_statements', newStatements);
                            }}
                          />
                        </Group>
                      ))}
                    </Stack>
                    <Alert color="blue" variant="light" mt="sm">
                      K-Prim: Schüler erhalten volle Punktzahl nur wenn alle 4 Aussagen korrekt bewertet werden.
                    </Alert>
                  </div>
                )}

                {/* Free Text */}
                {form.values.type === 'free_text' && (
                  <>
                    <Select
                      label="Erwartete Antwortlänge"
                      data={[
                        { value: 'word', label: '1 Wort' },
                        { value: 'short', label: 'Kurz (1-2 Sätze)' },
                        { value: 'medium', label: 'Mittel (1 Absatz)' },
                        { value: 'long', label: 'Lang (mehrere Absätze)' },
                      ]}
                      {...form.getInputProps('expected_length')}
                    />
                    <Textarea
                      label="Musterlösung (optional)"
                      placeholder="Geben Sie hier eine Musterlösung ein..."
                      minRows={3}
                      {...form.getInputProps('sample_answer')}
                    />
                  </>
                )}

                {/* Essay */}
                {form.values.type === 'essay' && (
                  <>
                    <Group grow>
                      <NumberInput
                        label="Minimale Wortanzahl"
                        placeholder="Optional"
                        min={0}
                        {...form.getInputProps('min_words')}
                      />
                      <NumberInput
                        label="Maximale Wortanzahl"
                        placeholder="Optional"
                        min={0}
                        {...form.getInputProps('max_words')}
                      />
                    </Group>
                    <Textarea
                      label="Bewertungskriterien (für Lehrer)"
                      placeholder="z.B. Struktur, Argumentation, Rechtschreibung..."
                      minRows={3}
                      {...form.getInputProps('rubric')}
                    />
                  </>
                )}

                {/* Cloze */}
                {form.values.type === 'cloze' && (
                  <>
                    <div>
                      <Textarea
                        label="Lückentext"
                        description="Verwenden Sie {{id}} für Lücken, z.B. 'Die Hauptstadt von Deutschland ist {{berlin}}.'"
                        placeholder="Die Hauptstadt von {{land1}} ist {{stadt1}}."
                        minRows={4}
                        value={form.values.cloze_text}
                        onChange={(e) => {
                          form.setFieldValue('cloze_text', e.target.value);
                          parseClozeText(e.target.value);
                        }}
                        error={form.errors.cloze_text}
                      />
                    </div>
                    {form.values.cloze_blanks.length > 0 && (
                      <div>
                        <Text size="sm" fw={500} mb="xs">Lücken-Antworten</Text>
                        <Stack gap="sm">
                          {form.values.cloze_blanks.map((blank, index) => (
                            <Group key={blank.id} gap="sm">
                              <Badge variant="outline">{`{{${blank.id}}}`}</Badge>
                              <TextInput
                                style={{ flex: 1 }}
                                placeholder="Richtige Antwort(en), kommagetrennt"
                                value={blank.correct_answers.join(', ')}
                                onChange={(e) => {
                                  const newBlanks = [...form.values.cloze_blanks];
                                  newBlanks[index] = {
                                    ...newBlanks[index],
                                    correct_answers: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
                                  };
                                  form.setFieldValue('cloze_blanks', newBlanks);
                                }}
                              />
                              <Checkbox
                                label="Gross-/Kleinschreibung"
                                checked={blank.case_sensitive || false}
                                onChange={(e) => {
                                  const newBlanks = [...form.values.cloze_blanks];
                                  newBlanks[index] = { ...newBlanks[index], case_sensitive: e.currentTarget.checked };
                                  form.setFieldValue('cloze_blanks', newBlanks);
                                }}
                              />
                            </Group>
                          ))}
                        </Stack>
                      </div>
                    )}
                  </>
                )}

                {/* Matching */}
                {form.values.type === 'matching' && (
                  <div>
                    <Text size="sm" fw={500} mb="xs">Zuordnungspaare</Text>
                    {form.errors.matching_pairs && (
                      <Alert icon={<IconAlertCircle size={16} />} color="red" mb="sm">
                        {form.errors.matching_pairs}
                      </Alert>
                    )}
                    <Stack gap="sm">
                      {form.values.matching_pairs.map((pair, index) => (
                        <Group key={pair.id} gap="sm">
                          <TextInput
                            style={{ flex: 1 }}
                            placeholder="Linke Seite"
                            value={pair.left}
                            onChange={(e) => {
                              const newPairs = [...form.values.matching_pairs];
                              newPairs[index] = { ...newPairs[index], left: e.target.value };
                              form.setFieldValue('matching_pairs', newPairs);
                            }}
                          />
                          <Text>↔</Text>
                          <TextInput
                            style={{ flex: 1 }}
                            placeholder="Rechte Seite"
                            value={pair.right}
                            onChange={(e) => {
                              const newPairs = [...form.values.matching_pairs];
                              newPairs[index] = { ...newPairs[index], right: e.target.value };
                              form.setFieldValue('matching_pairs', newPairs);
                            }}
                          />
                          <ActionIcon variant="subtle" color="red" onClick={() => removeMatchingPair(index)} disabled={form.values.matching_pairs.length <= 2}>
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Group>
                      ))}
                      <Button variant="light" leftSection={<IconPlus size={16} />} onClick={addMatchingPair}>
                        Paar hinzufügen
                      </Button>
                    </Stack>
                    <Alert color="blue" variant="light" mt="sm">
                      Die rechte Seite wird für die Schüler gemischt angezeigt.
                    </Alert>
                  </div>
                )}

                {/* File Upload */}
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
                  </>
                )}
              </Stack>
            </Paper>

            <Group justify="flex-end">
              <Button variant="subtle" onClick={() => navigate('/questions')}>
                Abbrechen
              </Button>
              <Button type="submit" loading={creating || updating}>
                {isEditing ? 'Speichern' : 'Erstellen'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Stack>
    </Container>
  );
};
