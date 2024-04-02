const express = require('express');
const HttpStatus = require('http-status-codes');

class ResponseHelper {
  init() {
    express.response.success = this.success;
    express.response.created = this.created;
    express.response.error = this.error;
    express.response.notFound = this.notFound;
    express.response.badRequest = this.badRequest;
    express.response.notAuthorized = this.notAuthorized;
    express.response.throwError = this.throwError;
  }

  created(data) {
    this.status(HttpStatus.CREATED).send({
      success: true,
      data,
    });
  }

  success(data) {
    this.status(HttpStatus.OK).send({
      success: true,
      data,
    });
  }

  error(error) {
    this.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
      success: false,
      error: {
        message: error.message,
      },
    });
  }

  notFound(message) {
    this.status(HttpStatus.NOT_FOUND).send({
      success: false,
      error: { message } || 'Not found.',
    });
  }

  badRequest(errors) {
    this.status(HttpStatus.BAD_REQUEST).json({
      success: false,
      error: { message: errors },
    });
  }

  throwError(err) {
    const error = err.details.reduce((prev, curr) => {
      prev[curr.path[0]] = curr.message.replace(/"/g, '');
      return prev;
    }, {});

    this.status(HttpStatus.UNPROCESSABLE_ENTITY).json({
      success: false,
      error,
    });
  }

  notAuthorized(error) {
    this.status(HttpStatus.UNAUTHORIZED).send({
      success: false,
      error,
    });
  }
}

module.exports = ResponseHelper;
