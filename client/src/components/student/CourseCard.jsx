import { useContext } from 'react'
import PropTypes from 'prop-types'
import { Link } from 'react-router-dom'
import { assets } from '../../assets/assets'
import { AppContext } from '../../context/AppContext'

const CourseCard = ({ course }) => {

    const { currency, calculateRating } = useContext(AppContext)

    return (
        <Link onClick={() => scrollTo(0, 0)} to={'/course/' + course._id} className="border border-gray-500/30 pb-6 overflow-hidden rounded-lg">
            <img className="w-full" src={course.courseThumbnail} alt='' />
            <div className="p-3 text-left">
                <h3 className="text-base font-semibold">{course.courseTitle}</h3>
                <p className="text-gray-500">{course.educator?.name}</p>
                <div className="flex items-center space-x-2">
                    <p>{calculateRating(course)}</p>
                    <div className="flex">
                        {[...Array(5)].map((_, i) => (
                            <img
                                key={i}
                                className="w-3.5 h-3.5"
                                src={i < Math.floor(calculateRating(course)) ? assets.star : assets.star_blank}
                                alt=""
                            />
                        ))}
                    </div>
                    <p className="text-gray-500">({course.courseRatings?.length || 0})</p>
                </div>
                <p className="text-base font-semibold text-gray-800">{currency}{(course.coursePrice - course.discount * course.coursePrice / 100).toFixed(2)}</p>
            </div>
        </Link>
    )
}

CourseCard.propTypes = {
    course: PropTypes.shape({
        _id: PropTypes.string.isRequired,
        courseTitle: PropTypes.string.isRequired,
        courseThumbnail: PropTypes.string,
        educator: PropTypes.shape({
            name: PropTypes.string,
        }),
        courseRatings: PropTypes.array,
        coursePrice: PropTypes.number,
        discount: PropTypes.number,
    }).isRequired,
}

export default CourseCard

