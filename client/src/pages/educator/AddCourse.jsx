import {
  useEffect,
  useRef,
  useState,
  useContext
} from 'react';
import uniqid from 'uniqid';
import Quill from 'quill';
import axios from 'axios';
import { assets } from '../../assets/assets';
import { AppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';

const AddCourse = () => {

  const { backendUrl, getToken } = useContext(AppContext);

  const quillRef = useRef(null);
  const editorRef = useRef(null);

  const [courseTitle, setCourseTitle] = useState('');
  const [coursePrice, setCoursePrice] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [image, setImage] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [showPopup, setShowPopup] = useState(false);
  const [currentChapterId, setCurrentChapterId] = useState(null);

  const [lectureDetails, setLectureDetails] = useState({
    lectureTitle: '',
    lectureDuration: '',
    lectureUrl: '',
    isPreviewFree: false,
  });

  // =========================
  // CHAPTER HANDLING
  // =========================

  const handleChapter = (action, chapterId) => {

    if (action === 'add') {

      const title = prompt("Enter Chapter Name:");

      if (title) {

        const newChapter = {
          chapterId: uniqid(),
          chapterTitle: title,
          chapterContent: [],
          collapsed: false,
          chapterOrder:
            chapters.length > 0
              ? chapters[chapters.length - 1].chapterOrder + 1
              : 1,
        };

        setChapters([...chapters, newChapter]);
      }

    } else if (action === 'remove') {

      setChapters(
        chapters.filter(
          (chapter) => chapter.chapterId !== chapterId
        )
      );

    } else if (action === 'toggle') {

      setChapters(
        chapters.map((chapter) =>
          chapter.chapterId === chapterId
            ? {
                ...chapter,
                collapsed: !chapter.collapsed
              }
            : chapter
        )
      );
    }
  };

  // =========================
  // LECTURE HANDLING
  // =========================

  const handleLecture = (action, chapterId, lectureIndex) => {

    if (action === 'add') {

      setCurrentChapterId(chapterId);
      setShowPopup(true);

    } else if (action === 'remove') {

      setChapters(
        chapters.map((chapter) => {

          if (chapter.chapterId === chapterId) {

            const updatedContent = [...chapter.chapterContent];

            updatedContent.splice(lectureIndex, 1);

            return {
              ...chapter,
              chapterContent: updatedContent
            };
          }

          return chapter;
        })
      );
    }
  };

  // =========================
  // ADD LECTURE
  // =========================

  const addLecture = () => {

    if (!lectureDetails.lectureTitle) {
      return toast.error('Please enter lecture title');
    }

    if (!lectureDetails.lectureDuration) {
      return toast.error('Please enter lecture duration');
    }

    if (!lectureDetails.lectureUrl) {
      return toast.error('Please enter lecture URL');
    }

    setChapters(
      chapters.map((chapter) => {

        if (chapter.chapterId === currentChapterId) {

          const newLecture = {
            ...lectureDetails,

            lectureDuration: Number(
              lectureDetails.lectureDuration
            ),

            lectureOrder:
              chapter.chapterContent.length > 0
                ? chapter.chapterContent[
                    chapter.chapterContent.length - 1
                  ].lectureOrder + 1
                : 1,

            lectureId: uniqid()
          };

          return {
            ...chapter,
            chapterContent: [
              ...chapter.chapterContent,
              newLecture
            ]
          };
        }

        return chapter;
      })
    );

    setShowPopup(false);

    setLectureDetails({
      lectureTitle: '',
      lectureDuration: '',
      lectureUrl: '',
      isPreviewFree: false,
    });
  };

  // =========================
  // SUBMIT COURSE
  // =========================

  const handleSubmit = async (e) => {

    e.preventDefault();

    try {

      // Check backend URL
      if (!backendUrl) {
        return toast.error(
          'Backend URL is not configured'
        );
      }

      // Check course title
      if (!courseTitle.trim()) {
        return toast.error(
          'Please enter course title'
        );
      }

      // Check description
      if (
        !quillRef.current ||
        !quillRef.current.root.innerHTML.trim() ||
        quillRef.current.root.innerHTML === '<p><br></p>'
      ) {
        return toast.error(
          'Please enter course description'
        );
      }

      // Check thumbnail
      if (!image) {
        return toast.error(
          'Please select a course thumbnail'
        );
      }

      // Check chapters
      if (chapters.length === 0) {
        return toast.error(
          'Please add at least one chapter'
        );
      }

      // Check whether chapters contain lectures
      const hasLectures = chapters.some(
        (chapter) =>
          chapter.chapterContent &&
          chapter.chapterContent.length > 0
      );

      if (!hasLectures) {
        return toast.error(
          'Please add at least one lecture'
        );
      }

      // Create course data
      const courseData = {
        courseTitle: courseTitle.trim(),

        courseDescription:
          quillRef.current.root.innerHTML,

        coursePrice: Number(coursePrice),

        discount: Number(discount),

        courseContent: chapters
      };

      // Create FormData
      const formData = new FormData();

      // Add thumbnail
      formData.append(
        'image',
        image
      );

      // Add course data as JSON string
      formData.append(
        'courseData',
        JSON.stringify(courseData)
      );

      // Get Clerk authentication token
      const token = await getToken();

      // Send request to backend
      const { data } = await axios.post(
        `${backendUrl}/api/educator/add-course`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      // Handle response
      if (data.success) {

        toast.success(
          data.message || 'Course Added Successfully'
        );

        // Reset form
        setCourseTitle('');
        setCoursePrice(0);
        setDiscount(0);
        setImage(null);
        setChapters([]);

        // Reset Quill editor
        if (quillRef.current) {
          quillRef.current.root.innerHTML = '';
        }

      } else {

        toast.error(
          data.message || 'Failed to add course'
        );
      }

    } catch (error) {

      console.error(
        'Add Course Error:',
        error
      );

      toast.error(
        error.response?.data?.message ||
        error.message ||
        'Something went wrong'
      );
    }
  };

  // =========================
  // INITIALIZE QUILL
  // =========================

  useEffect(() => {

    if (
      !quillRef.current &&
      editorRef.current
    ) {

      quillRef.current = new Quill(
        editorRef.current,
        {
          theme: 'snow',
        }
      );
    }

  }, []);

  // =========================
  // UI
  // =========================

  return (

    <div
      className='h-screen overflow-scroll flex flex-col
      items-start justify-between md:p-8 md:pb-0
      p-4 pt-8 pb-0'
    >

      <form
        onSubmit={handleSubmit}
        className='flex flex-col gap-4
        max-w-md w-full text-gray-500'
      >

        {/* COURSE TITLE */}

        <div className='flex flex-col gap-1'>

          <p>Course Title</p>

          <input
            onChange={(e) =>
              setCourseTitle(e.target.value)
            }
            value={courseTitle}
            type="text"
            placeholder='Type here'
            className='outline-none md:py-2.5
            py-2 px-3 rounded
            border border-gray-500'
            required
          />

        </div>

        {/* COURSE DESCRIPTION */}

        <div className='flex flex-col gap-1'>

          <p>Course Description</p>

          <div ref={editorRef}></div>

        </div>

        {/* PRICE + THUMBNAIL */}

        <div
          className='flex items-center
          justify-between flex-wrap'
        >

          {/* COURSE PRICE */}

          <div className='flex flex-col gap-1'>

            <p>Course Price</p>

            <input
              onChange={(e) =>
                setCoursePrice(e.target.value)
              }
              value={coursePrice}
              type="number"
              placeholder='0'
              min={0}
              className='outline-none
              md:py-2.5 py-2 w-28
              px-3 rounded
              border border-gray-500'
              required
            />

          </div>

          {/* COURSE THUMBNAIL */}

          <div
            className='flex md:flex-row
            flex-col items-center gap-3'
          >

            <p>Course Thumbnail</p>

            <label
              htmlFor='thumbnailImage'
              className='flex items-center gap-3'
            >

              <img
                src={assets.file_upload_icon}
                alt="Upload"
                className='p-3 bg-blue-500 rounded'
              />

              <input
                type="file"
                id="thumbnailImage"
                onChange={(e) =>
                  setImage(e.target.files[0])
                }
                accept="image/*"
                hidden
              />

              {image && (
                <img
                  className='max-h-10'
                  src={URL.createObjectURL(image)}
                  alt="Course thumbnail preview"
                />
              )}

            </label>

          </div>

        </div>

        {/* DISCOUNT */}

        <div className='flex flex-col gap-1'>

          <p>Discount %</p>

          <input
            onChange={(e) =>
              setDiscount(e.target.value)
            }
            value={discount}
            type="number"
            placeholder='0'
            min={0}
            max={100}
            className='outline-none
            md:py-2.5 py-2 w-28
            px-3 rounded
            border border-gray-500'
            required
          />

        </div>

        {/* CHAPTERS & LECTURES */}

        <div>

          {chapters.map(
            (chapter, chapterIndex) => (

              <div
                key={chapter.chapterId}
                className="bg-white border
                rounded-lg mb-4"
              >

                {/* CHAPTER HEADER */}

                <div
                  className="flex justify-between
                  items-center p-4 border-b"
                >

                  <div
                    className="flex items-center"
                  >

                    <img
                      src={assets.dropdown_icon}
                      width={14}
                      alt="Toggle chapter"
                      onClick={() =>
                        handleChapter(
                          'toggle',
                          chapter.chapterId
                        )
                      }
                      className={`mr-2 cursor-pointer
                      transition-all ${
                        chapter.collapsed
                          ? "-rotate-90"
                          : ""
                      }`}
                    />

                    <span
                      className="font-semibold"
                    >
                      {chapterIndex + 1}{' '}
                      {chapter.chapterTitle}
                    </span>

                  </div>

                  <span className="text-gray-500">

                    {chapter.chapterContent.length}{' '}
                    Lectures

                  </span>

                  <img
                    src={assets.cross_icon}
                    alt="Remove chapter"
                    onClick={() =>
                      handleChapter(
                        'remove',
                        chapter.chapterId
                      )
                    }
                    className='cursor-pointer'
                  />

                </div>

                {/* LECTURES */}

                {!chapter.collapsed && (

                  <div className='p-4'>

                    {chapter.chapterContent.map(
                      (lecture, lectureIndex) => (

                        <div
                          key={lecture.lectureId}
                          className='flex justify-between
                          items-center mb-2'
                        >

                          <span>

                            {lectureIndex + 1}{' '}
                            {lecture.lectureTitle}
                            {' - '}
                            {lecture.lectureDuration}
                            {' mins - '}

                            <a
                              href={lecture.lectureUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-500"
                            >
                              Link
                            </a>

                            {' - '}

                            {lecture.isPreviewFree
                              ? 'Free Preview'
                              : 'Paid'}

                          </span>

                          <img
                            src={assets.cross_icon}
                            alt="Remove lecture"
                            onClick={() =>
                              handleLecture(
                                'remove',
                                chapter.chapterId,
                                lectureIndex
                              )
                            }
                            className='cursor-pointer'
                          />

                        </div>

                      )
                    )}

                    {/* ADD LECTURE */}

                    <div
                      className='inline-flex
                      bg-gray-100 p-2
                      rounded cursor-pointer mt-2'
                      onClick={() =>
                        handleLecture(
                          'add',
                          chapter.chapterId
                        )
                      }
                    >
                      + Add Lecture
                    </div>

                  </div>

                )}

              </div>

            )
          )}

          {/* ADD CHAPTER */}

          <div
            className='flex justify-center
            items-center bg-blue-100 p-2
            rounded-lg cursor-pointer'
            onClick={() =>
              handleChapter('add')
            }
          >
            + Add Chapter
          </div>

          {/* ADD LECTURE POPUP */}

          {showPopup && (

            <div
              className="fixed inset-0
              flex items-center justify-center
              bg-gray-800 bg-opacity-50"
            >

              <div
                className="bg-white text-gray-700
                p-4 rounded relative
                w-full max-w-80"
              >

                <h2
                  className="text-lg
                  font-semibold mb-4"
                >
                  Add Lecture
                </h2>

                {/* LECTURE TITLE */}

                <div className="mb-2">

                  <p>Lecture Title</p>

                  <input
                    type="text"
                    className="mt-1 block w-full
                    border rounded py-1 px-2"
                    value={
                      lectureDetails.lectureTitle
                    }
                    onChange={(e) =>
                      setLectureDetails({
                        ...lectureDetails,
                        lectureTitle:
                          e.target.value,
                      })
                    }
                  />

                </div>

                {/* DURATION */}

                <div className="mb-2">

                  <p>Duration (minutes)</p>

                  <input
                    type="number"
                    className="mt-1 block w-full
                    border rounded py-1 px-2"
                    value={
                      lectureDetails.lectureDuration
                    }
                    onChange={(e) =>
                      setLectureDetails({
                        ...lectureDetails,
                        lectureDuration:
                          e.target.value,
                      })
                    }
                  />

                </div>

                {/* LECTURE URL */}

                <div className="mb-2">

                  <p>Lecture URL</p>

                  <input
                    type="text"
                    className="mt-1 block w-full
                    border rounded py-1 px-2"
                    value={
                      lectureDetails.lectureUrl
                    }
                    onChange={(e) =>
                      setLectureDetails({
                        ...lectureDetails,
                        lectureUrl:
                          e.target.value
                      })
                    }
                  />

                </div>

                {/* FREE PREVIEW */}

                <div
                  className="flex gap-2 my-4"
                >

                  <p>Is Preview Free?</p>

                  <input
                    type="checkbox"
                    className='mt-1 scale-125'
                    checked={
                      lectureDetails.isPreviewFree
                    }
                    onChange={(e) =>
                      setLectureDetails({
                        ...lectureDetails,
                        isPreviewFree:
                          e.target.checked
                      })
                    }
                  />

                </div>

                {/* ADD LECTURE BUTTON */}

                <button
                  type='button'
                  className='w-full bg-blue-400
                  text-white px-4 py-2
                  rounded'
                  onClick={addLecture}
                >
                  Add
                </button>

                {/* CLOSE POPUP */}

                <img
                  onClick={() =>
                    setShowPopup(false)
                  }
                  src={assets.cross_icon}
                  className='absolute top-4
                  right-4 w-4 cursor-pointer'
                  alt="Close"
                />

              </div>

            </div>

          )}

        </div>

        {/* SUBMIT COURSE */}

        <button
          type='submit'
          className='bg-black text-white
          w-max py-2.5 px-8
          rounded my-4'
        >
          ADD
        </button>

      </form>

    </div>
  );
};

export default AddCourse;