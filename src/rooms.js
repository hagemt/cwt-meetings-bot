import React from 'react';
import { List, Datagrid, Edit, Create, BooleanInput, SimpleForm, DateField, TextField, EditButton, DisabledInput, TextInput, LongTextInput, DateInput } from 'admin-on-rest';
import BookIcon from 'material-ui/svg-icons/action/book';
import ReserveButton from './rooms/ReserveButton';

export const RoomList = (props) => (
    <List title="All rooms" {...props}>
    <Datagrid>
        <TextField source="id" />
        <TextField source="name" />
        <TextField source="reserved" />
        <ReserveButton/>
    </Datagrid>
    </List>
);

const RoomName = ({ record }) => {
    return <span>Room {record ? `"${record.name}"` : ''}</span>;
};
