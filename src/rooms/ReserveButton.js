import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import FlatButton from 'material-ui/FlatButton';
import { showNotification as showNotificationAction } from 'admin-on-rest';
import { push as pushAction } from 'react-router-redux';
import { simpleRestClient } from 'admin-on-rest';
import { UPDATE } from 'admin-on-rest';

class ReserveButton extends Component {
    handleClick = () => {
        const { push, record, showNotification } = this.props;
        const updatedRecord = { ...record, reserved: true };

        simpleRestClient('http://my-json-server.typicode.com/sfsgagi/gitvim/blob/master')(UPDATE, 'rooms', { id: record.id, data: updatedRecord })
        .then(() => {
            showNotification('Room reserved');
            push('/rooms');
        })
        .catch((e) => {
            console.error(e);
            showNotification('Error: room not approved', 'warning')
        });
/*

        fetch(`/rooms/${record.id}`, { method: 'POST', body: updatedRecord })
        .then(() => {
            showNotification('Room reserved');
            push('/rooms');
        })
        .catch((e) => {
            console.error(e);
            showNotification('Error: room is not reserved', 'warning')
        });*/
    }

    render() {
        return <FlatButton label="Reserve" onClick={this.handleClick} />;
    }
}

ReserveButton.propTypes = {
    push: PropTypes.func,
    record: PropTypes.object,
    showNotification: PropTypes.func,
};

export default connect(null, {
    showNotification: showNotificationAction,
    push: pushAction,
})(ReserveButton);
