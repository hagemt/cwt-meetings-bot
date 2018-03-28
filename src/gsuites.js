import React from 'react';
import { List, Datagrid, Edit, Create, SimpleForm, DateField, TextField, EditButton, DisabledInput, TextInput, LongTextInput, DateInput } from 'admin-on-rest';
import BookIcon from 'material-ui/svg-icons/action/book';

export const GsuiteList = (props) => (
    <List title="All gsuites" {...props}>
    <Datagrid>
        <TextField source="id" />
        <TextField source="email" />
    </Datagrid>
    </List>
);

const GsuiteName = ({ record }) => {
    return <span>Gsuite {record ? `"${record.email}"` : ''}</span>;
};

/*
export const PostEdit = (props) => (
    <Edit title={<PostTitle />} {...props}>
    <SimpleForm>
    <DisabledInput source="id" />
    <TextInput source="title" />
    <TextInput source="teaser" options={{ multiLine: true }} />
    <LongTextInput source="body" />
    <DateInput label="Publication date" source="published_at" />
    <TextInput source="average_note" />
    <DisabledInput label="Nb views" source="views" />
    </SimpleForm>
    </Edit>
);

export const PostCreate = (props) => (
    <Create title="Create a Post" {...props}>
    <SimpleForm>
        <TextInput source="title" />
        <TextInput source="teaser" options={{ multiLine: true }} />
        <LongTextInput source="body" />
        <TextInput label="Publication date" source="published_at" />
        <TextInput source="average_note" />
    </SimpleForm>
    </Create>
);*/
