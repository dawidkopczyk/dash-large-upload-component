from flask import request 
from flask import abort 
import os 
import shutil 
import time

import dash
import dash_html_components as html
import dash_large_upload_component as dluc
from dash.dependencies import Input, Output

UPLOAD_FOLDER = "uploads"


app = dash.Dash()


def get_chunk_name(uploaded_filename, chunk_number):
    return uploaded_filename + "_part_%03d" % chunk_number

# resumable.js uses a GET request to check if it uploaded the file already.
# NOTE: your validation here needs to match whatever you do in the POST
# (otherwise it will NEVER find the files)
@app.server.route("/upload_resumable", methods=['GET'])
def resumable():
    
    resumableIdentfier = request.args.get('resumableIdentifier', type=str)
    resumableFilename = request.args.get('resumableFilename', type=str)
    resumableChunkNumber = request.args.get('resumableChunkNumber', type=int)

    if not (resumableIdentfier
            and resumableFilename
            and resumableChunkNumber):
        # Parameters are missing or invalid
        abort(500, 'Parameter error')

    # chunk folder path based on the parameters
    temp_dir = os.path.join(UPLOAD_FOLDER, resumableIdentfier)

    # chunk path based on the parameters
    chunk_file = os.path.join(
        temp_dir,
        get_chunk_name(resumableFilename, resumableChunkNumber)
    )
    app.server.logger.debug('Getting chunk: %s', chunk_file)

    if os.path.isfile(chunk_file):
        # Let resumable.js know this chunk already exists
        return 'OK'
    else:
        # Let resumable.js know this chunk does not exists
        # and needs to be uploaded
        abort(404, 'Not found')

# if it didn't already upload, resumable.js sends the file here
@app.server.route("/upload_resumable", methods=['POST'])
def resumable_post():

    resumableTotalChunks = request.form.get('resumableTotalChunks', type=int)
    resumableChunkNumber = request.form.get('resumableChunkNumber', default=1, type=int)
    resumableFilename = request.form.get('resumableFilename', default='error', type=str)
    resumableIdentfier = request.form.get('resumableIdentifier', default='error', type=str)

    # get the chunk data
    chunk_data = request.files['file']

    # make our temp directory
    temp_dir = os.path.join(UPLOAD_FOLDER, resumableIdentfier)
    if not os.path.isdir(temp_dir):
        os.makedirs(temp_dir)

    # save the chunk data
    chunk_name = get_chunk_name(resumableFilename, resumableChunkNumber)
    chunk_file = os.path.join(temp_dir, chunk_name)

    # make a lock file
    lock_file_path = os.path.join(
        temp_dir,
        '.lock_{:d}'.format(resumableChunkNumber)
    )

    with open(lock_file_path, 'a'):
        os.utime(lock_file_path, None)
    chunk_data.save(chunk_file)
    app.server.logger.debug('Saved chunk: %s', chunk_file)
    os.unlink(lock_file_path)

    # check if the upload is complete
    chunk_paths = [
        os.path.join(temp_dir, get_chunk_name(resumableFilename, x))
        for x in range(1, resumableTotalChunks+1)
    ]
    upload_complete = all([os.path.exists(p) for p in chunk_paths])

    # combine all the chunks to create the final file
    if upload_complete:
        # Make sure all files are finished writing
        while any([os.path.isfile(
                  os.path.join(temp_dir, '.lock_{:d}'.format(chunk))
                  ) for chunk in range(1, resumableTotalChunks + 1)]):
            time.sleep(1)
        # Make sure some other chunk didn't trigger file reconstruction
        target_file_name = os.path.join(UPLOAD_FOLDER, resumableFilename)
        if os.path.exists(target_file_name):
            os.remove(target_file_name)
        with open(target_file_name, "ab") as target_file:
            for p in chunk_paths:
                with open(p, 'rb') as stored_chunk_file:
                    target_file.write(stored_chunk_file.read())
        app.server.logger.debug('File saved to: %s', target_file_name)
        shutil.rmtree(temp_dir)

    return resumableFilename


app.scripts.config.serve_locally = True  # Uploaded to npm, this can work online now too.

app.layout = html.Div([
    dluc.Upload(
        id='upload',
        maxFiles=1,
        maxFileSize=1024*1024*500,  # 500MB
        service="/upload_resumable",
        children=html.Div(
            [
                html.Span('Drag and Drop or '),
                html.A(
                    'Select Files',
                    className='btn btn-warning',
                    style=dict(color='white', padding='0 0.2rem')
                ),
                html.Br(),
                html.Span('Acceptable formats: (.csv), (.txt), (.xls), (.xlsx), (.xlsm) and (.json).',
                          style={'fontSize': '14px'})
            ]
        ),
        simultaneousUploads=1,  # Tested only with = 1
        filetypes=['csv']
    ),
    html.Div(id='output')
])


@app.callback(Output('output', 'children'),
              [Input('upload', 'fileNames')])
def display_files(filenames):
    if filenames is not None:
        return html.Ul([html.Li(
            html.P(x)) for x in filenames])
    return html.Ul(html.Li("No Files Uploaded Yet!"))


if __name__ == '__main__':
    app.run_server(debug=True)
