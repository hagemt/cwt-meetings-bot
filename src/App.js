import React from 'react';
import { jsonServerRestClient, Admin, Resource } from 'admin-on-rest';

import { RoomList } from './rooms';
import { GsuiteList } from './gsuites';

const App = () => (
    <Admin restClient={jsonServerRestClient('http://my-json-server.typicode.com/sfsgagi/gitvim/blob/master')}>
        <Resource name="rooms" list={RoomList} />
        <Resource name="gsuites" list={GsuiteList} />
    </Admin>
);

export default App;
