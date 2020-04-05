import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Resumablejs from 'resumablejs';

export default class Upload extends Component {
	
    constructor(props) {
        super(props);
        this.state = {
            progressBar: 0,
            messageStatus: '',
            fileList: {files: []},
            isUploading: false,
            isHovered: false,
            isComplete: false
        };
        this.toggleHovered = this.toggleHovered.bind(this)
        this.resumable = null;
    }

    componentDidMount() {

        const ResumableField = new Resumablejs({
            target: this.props.service,
            query: {},
            fileType: this.props.filetypes,
            maxFiles: this.props.maxFiles,
            maxFileSize: this.props.maxFileSize,
            fileTypeErrorCallback: () => {
                this.setState({
                    messageStatus: 'Invalid file type!'
                });
            },
            testMethod: 'post',
            testChunks: false,
            headers: {},
            chunkSize: this.props.chunkSize,
            simultaneousUploads: this.props.simultaneousUploads,
            forceChunkSize: false
        });

        ResumableField.assignBrowse(this.uploader);

        //Enable or Disable DragAnd Drop
        if (this.props.disableDragAndDrop === false) {
            ResumableField.assignDrop(this.dropZone);
        }

        ResumableField.on('fileAdded', (file) => {
            this.setState({
                messageStatus: this.props.fileAddedMessage || ' Starting upload! of ' + file.fileName,
                isComplete: false
            });

             if (typeof this.props.onFileAdded === 'function') {
                 this.props.onFileAdded(file, this.resumable);
             } else {
                 ResumableField.upload();
             }
        });

        ResumableField.on('fileSuccess', (file, fileServer) => {

            if (this.props.fileNameServer) {
                let objectServer = JSON.parse(fileServer);
                file.fileName = objectServer[this.props.fileNameServer];
            } else {
                file.fileName = fileServer;
            }
            let currentFiles = this.state.fileList.files;
            currentFiles.push(file);

            let fileNames = this.props.fileNames
            fileNames.push(file.fileName);

            if (this.props.setProps) {
                this.props.setProps({
                      fileNames: fileNames
                });
            }
            this.setState({
                fileList: {files: currentFiles},
                isComplete: true,
                messageStatus: this.props.completedMessage + file.fileName || fileServer
            }, () => {
                if (typeof this.props.onFileSuccess === 'function') {
                    this.props.onFileSuccess(file, fileServer);
                }
            });
        });

        ResumableField.on('progress', () => {


            this.setState({
                isUploading: ResumableField.isUploading()
            });

            if ((ResumableField.progress() * 100) < 100) {
                this.setState({
                    messageStatus: parseInt(ResumableField.progress() * 100, 10) + '%',
                    progressBar: ResumableField.progress() * 100
                });
            } else {
                setTimeout(() => {
                    this.setState({
                        progressBar: 0
                    })
                }, 1000);
            }

        });

        ResumableField.on('fileError', (file, errorCount) => {
            this.props.onUploadErrorCallback(file, errorCount);
        });

        this.resumable = ResumableField;
    }

    toggleHovered() {
        this.setState({
            isHovered: !this.state.isHovered
        })
    }

    render() {

        let getStyle = () => {
            if (this.state.isComplete) {
                return this.props.completeStyle;
            } else if (this.state.isHovered || this.state.isUploading) {
                return this.props.activeStyle;
            } else {
                return this.props.defaultStyle;
            }
        }

        let getClass = () => {
            if (this.props.disabledInput) {
              return this.props.disableClass;
            } else if (this.state.isHovered) {
              return this.props.hoveredClass;
            } else if (this.state.isUploading) {
              return this.props.uploadingClass;
            } else if (this.state.isComplete) {
              return this.props.completeClass;
            } else {
              return this.props.className
            }
        }

        return(
            <div 
				id={this.props.id} 
				className={getClass()} 
				ref={node => this.dropZone = node}
			>
                <label 
					style={getStyle()} 
					onMouseEnter={this.toggleHovered} 
					onMouseLeave={this.toggleHovered}
				>
					{this.state.messageStatus == '' ? this.props.children : this.state.messageStatus}
                    <input
                        ref={node=> this.uploader = node}
                        type="file"
                        className='btn'
                        name={this.props.id + '-upload'}
                        accept={this.props.fileAccept || '*'}
                        disabled={this.props.disableInput || false}
                        style={{'opacity': '0',
                                'width': '0.1px%',
                                'height': '0.1px%',
                                'position': 'absolute',
                                'overflow': 'hidden',
                                'z-index': '-1'}}
                    >
					</input>
                </label>
                <div 
					className="progress" 
					style={{display: this.state.progressBar === 0 ? 'none' : 'block'}}
				>
                    <div 
						className="progress-bar" 
						style={{width: this.state.progressBar + '%', height: '100%'}}
					>
					</div>
                </div>
            </div>
        )
    }
}

Upload.defaultProps = {
    maxFiles: 1,
    maxFileSize: 1024 * 1024 * 10,
    chunkSize: 1024 * 1024,
    simultaneuosUploads: 1,
    service: '/upload',
    className: 'resumable-default',
    hoveredClass: 'resumable-hovered',
    completeClass: 'resumable-complete',
    disabledClass: 'resumable-disabled',
    uploadingClass: 'resumable-uploading',
    defaultStyle: {},
    activeStyle: {},
    completeStyle: {},
    completedMessage: 'Complete! ',
    fileNames: [],
    filetypes: undefined,
    disableDragAndDrop: false
};

Upload.propTypes = {
	
	/**
	* The ID of this component, used to identify dash components
	* in callbacks. The ID needs to be unique across all of the
	* components in an app.
	*/
	id: PropTypes.string,

	/**
	* The children of this component.
	*/
	children: PropTypes.node,
	
    /**
     * Maximum number of files that can be uploaded in one session
     */
    maxFiles: PropTypes.number,

    /**
     * Maximum size per file in bytes.
     */
    maxFileSize: PropTypes.number,

    /**
     * Size of file chunks to send to server.
     */
    chunkSize: PropTypes.number,

    /**
     * Number of simultaneous uploads to select
     */
    simultaneousUploads: PropTypes.number,

    /**
     * The service to send the files to
     */
    service: PropTypes.string,

    /**
     * Class to add to the upload component by default
     */
    className: PropTypes.string,

    /**
     * Class to add to the upload component when it is hovered
     */
    hoveredClass: PropTypes.string,

    /**
     * Class to add to the upload component when it is disabled
     */
    disabledClass: PropTypes.string,

    /**
     * Class to add to the upload component when it is complete
     */
    completeClass: PropTypes.string,

    /**
     * Class to add to the upload component when it is uploading
     */
    uploadingClass: PropTypes.string,

    /**
     * Style attributes to add to the upload component
     */
    defaultStyle: PropTypes.object,

    /**
     * Style when upload component is hovered over
     */
    activeStyle: PropTypes.object,

   /**
    * Style when upload is completed (upload finished)
    */
    completeStyle: PropTypes.object,

    /**
     * Message to display when upload completed
     */
    completedMessage: PropTypes.string,

    /**
     * The names of the files uploaded
     */
    fileNames: PropTypes.arrayOf(PropTypes.string),

    /**
     * List of allowed file types, e.g. ['jpg', 'png']
     */
    filetypes: PropTypes.arrayOf(PropTypes.string),

    /**
     * Whether or not to allow file drag and drop
     */
    disableDragAndDrop: PropTypes.bool,

    /**
     * Dash-assigned callback that should be called whenever any of the
     * properties change
     */
    setProps: PropTypes.func

}
